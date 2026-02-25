# Фаза 4 — Backend: нечіткий пошук (`search.rs`)

## Завдання

1. Структура `SearchResult { id: i64, title: String, score: i32, matched_positions: Vec<usize>, is_encrypted: bool }`
2. Функція `fuzzy_match_single_term(term: &str, title_lower: &str) -> Option<(i32, Vec<usize>)>` — послідовний пошук символів терміну в назві; повертає позиції збіглих символів та score
3. Функція `fuzzy_match(query: &str, title: &str) -> Option<(i32, Vec<usize>)>`:
   - Привести query та title до нижнього регістру
   - Розбити query по пробілах → слова; перевірити кожне слово через `fuzzy_match_single_term` (AND-логіка: **всі** слова мають збігтися)
   - Для однословного запиту (без пробілів): якщо прямий збіг не знайдено — запустити фолбек
   - Фолбек: перебрати всі 2-частинні розбивки `query[..i] + query[i..]` для `i` від 1 до `len-1`; взяти **першу** успішну розбивку (не кращу); score = base_score − 10
4. Функція `search(query: &str, snippets: &[(i64, String, bool)]) -> Vec<SearchResult>`:
   - Порожній запит → всі записи, score=0, matched_positions=[]; порядок збереження (за updated_at, вже відсортовані на вході)
   - Непорожній запит → застосувати `fuzzy_match` до кожного запису, відфільтрувати None, сортувати за score DESC

---

## 🤖 Автоматичні тести (TDD — написати ПЕРЕД реалізацією)

**Файл: `src-tauri/src/search.rs` → `#[cfg(test)] mod tests`**

Це найбільш тестований модуль — всі вимоги з PRD 2.2.1 стають тестами.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    // Хелпер для створення тестових даних
    fn snippets(items: &[(i64, &str, bool)]) -> Vec<(i64, String, bool)> {
        items.iter().map(|(id, t, e)| (*id, t.to_string(), *e)).collect()
    }

    // === fuzzy_match_single_term ===

    #[test]
    fn test_single_term_exact_match() {
        // "hello" у "hello" → Some з score та positions [0,1,2,3,4]
    }

    #[test]
    fn test_single_term_subsequence() {
        // "hlo" у "hello" → Some (h=0, l=2 або 3, o=4)
    }

    #[test]
    fn test_single_term_no_match() {
        // "xyz" у "hello" → None
    }

    #[test]
    fn test_single_term_partial_no_match() {
        // "hz" у "hello" → None (z не знайдено після h)
    }

    // === fuzzy_match (повна функція) ===

    #[test]
    fn test_case_insensitive_match() {
        // PRD: "HELLO" знаходить "hello world" ✓
        let result = fuzzy_match("HELLO", "hello world");
        assert!(result.is_some());
    }

    #[test]
    fn test_multi_term_and_logic() {
        // PRD: "pro prd" знаходить "prompt prd analize" ✓
        let result = fuzzy_match("pro prd", "prompt prd analize");
        assert!(result.is_some());
    }

    #[test]
    fn test_multi_term_and_logic_reversed() {
        // PRD: "pro prd" знаходить "prd add-req prompt" ✓
        let result = fuzzy_match("pro prd", "prd add-req prompt");
        assert!(result.is_some());
    }

    #[test]
    fn test_multi_term_one_missing() {
        // "pro xyz" НЕ знаходить "prompt prd analize" (AND-логіка)
        let result = fuzzy_match("pro xyz", "prompt prd analize");
        assert!(result.is_none());
    }

    #[test]
    fn test_fallback_split_proprd() {
        // PRD: "proprd" фолбек → "pro"+"prd" → знаходить "prompt prd analize" ✓
        let result = fuzzy_match("proprd", "prompt prd analize");
        assert!(result.is_some());
    }

    #[test]
    fn test_fallback_score_penalty() {
        // Фолбек-результати мають score на 10 менше за прямий збіг
        let direct = fuzzy_match("pro prd", "prompt prd analize").unwrap();
        let fallback = fuzzy_match("proprd", "prompt prd analize").unwrap();
        assert_eq!(direct.0 - fallback.0, 10);
    }

    #[test]
    fn test_fallback_uses_first_successful_split() {
        // Перша успішна розбивка використовується, не найкраща
        // "abc" → "a"+"bc", "ab"+"c" — перша успішна повинна бути стабільною
    }

    #[test]
    fn test_no_fallback_for_multi_term() {
        // Фолбек НЕ застосовується для запитів з пробілами
    }

    #[test]
    fn test_no_match_returns_none() {
        // "xyz" проти будь-якого рядка → None
        let result = fuzzy_match("xyz", "hello world");
        assert!(result.is_none());
    }

    // === search (повна функція з масивом сніпетів) ===

    #[test]
    fn test_empty_query_returns_all() {
        // PRD: порожній запит → всі записи у порядку updated_at
        let items = snippets(&[(1, "alpha", false), (2, "beta", true)]);
        let results = search("", &items);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].id, 1); // порядок збережено
        assert_eq!(results[1].id, 2);
    }

    #[test]
    fn test_empty_query_score_zero() {
        let items = snippets(&[(1, "alpha", false)]);
        let results = search("", &items);
        assert_eq!(results[0].score, 0);
        assert!(results[0].matched_positions.is_empty());
    }

    #[test]
    fn test_search_filters_non_matching() {
        let items = snippets(&[(1, "hello world", false), (2, "foo bar", false)]);
        let results = search("hel", &items);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, 1);
    }

    #[test]
    fn test_search_sorted_by_score_desc() {
        // Кращий збіг має вищий score → перший у результатах
        let items = snippets(&[
            (1, "abcdef", false),
            (2, "abc", false),
        ]);
        let results = search("abc", &items);
        assert!(results[0].score >= results.last().unwrap().score);
    }

    #[test]
    fn test_search_no_results() {
        // "xyz" без збігів → порожній масив
        let items = snippets(&[(1, "hello", false)]);
        let results = search("xyz", &items);
        assert!(results.is_empty());
    }

    #[test]
    fn test_search_returns_encrypted_flag() {
        let items = snippets(&[(1, "secret", true)]);
        let results = search("sec", &items);
        assert_eq!(results[0].is_encrypted, true);
    }

    #[test]
    fn test_search_returns_matched_positions() {
        let items = snippets(&[(1, "hello", false)]);
        let results = search("hlo", &items);
        assert!(!results[0].matched_positions.is_empty());
    }

    #[test]
    fn test_search_prd_scenario_pro_prd() {
        // Повний тест-кейс з PRD
        let items = snippets(&[
            (1, "prompt prd analize", false),
            (2, "prd add-req prompt", false),
            (3, "something else", false),
        ]);
        let results = search("pro prd", &items);
        assert_eq!(results.len(), 2);
        let ids: Vec<i64> = results.iter().map(|r| r.id).collect();
        assert!(ids.contains(&1));
        assert!(ids.contains(&2));
    }

    #[test]
    fn test_search_prd_scenario_proprd_fallback() {
        let items = snippets(&[
            (1, "prompt prd analize", false),
            (2, "something else", false),
        ]);
        let results = search("proprd", &items);
        assert_eq!(results.len(), 1);
        assert_eq!(results[0].id, 1);
    }

    #[test]
    fn test_search_whitespace_only_query() {
        // "   " → трактувати як порожній запит → всі записи
        let items = snippets(&[(1, "alpha", false)]);
        let results = search("   ", &items);
        assert_eq!(results.len(), 1);
    }
}
```

**Запуск:** `cd src-tauri && cargo test search::tests`

---

## ✅ Ручна перевірка по завершенні фази

- [x] `cargo test search::tests` — всі тести зелені (≥ 20 тестів)
- [x] PRD тест-кейси пройдені (pro prd, proprd, HELLO, порожній запит)
- [x] Фолбек-результати мають score на 10 менше, ніж прямий збіг
- [x] Запит «xyz» без збігів → порожній масив (не паніка)
