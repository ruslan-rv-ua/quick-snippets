// Fuzzy search

#[derive(Debug, Clone, PartialEq, serde::Serialize)]
pub struct SearchResult {
    pub id: i64,
    pub title: String,
    pub score: i32,
    pub matched_positions: Vec<usize>,
    pub is_encrypted: bool,
}

/// Sequential character search: returns (score, positions) or None.
/// Score = number_of_matched_chars * 10 (simple, deterministic for fallback penalty).
pub fn fuzzy_match_single_term(term: &str, title_lower: &str) -> Option<(i32, Vec<usize>)> {
    let title_chars: Vec<char> = title_lower.chars().collect();
    let mut positions = Vec::new();
    let mut ti = 0;

    for tc in term.chars() {
        let mut found = false;
        while ti < title_chars.len() {
            if title_chars[ti] == tc {
                positions.push(ti);
                ti += 1;
                found = true;
                break;
            }
            ti += 1;
        }
        if !found {
            return None;
        }
    }

    let score = (positions.len() as i32) * 10;
    Some((score, positions))
}

/// Fuzzy match a query against a title.
/// Multi-word queries use AND logic; single-word falls back to split search.
pub fn fuzzy_match(query: &str, title: &str) -> Option<(i32, Vec<usize>)> {
    let query_lower = query.to_lowercase();
    let title_lower = title.to_lowercase();

    let terms: Vec<&str> = query_lower.split_whitespace().collect();

    if terms.is_empty() {
        return None;
    }

    if terms.len() > 1 {
        // Multi-term AND logic — no fallback
        let mut total_score = 0i32;
        let mut all_positions = Vec::new();
        for term in &terms {
            match fuzzy_match_single_term(term, &title_lower) {
                Some((score, positions)) => {
                    total_score += score;
                    all_positions.extend(positions);
                }
                None => return None,
            }
        }
        return Some((total_score, all_positions));
    }

    let term = terms[0];

    // Direct single-term match
    if let Some((score, positions)) = fuzzy_match_single_term(term, &title_lower) {
        return Some((score, positions));
    }

    // Fallback: try all 2-part splits, return first successful one
    let term_chars: Vec<char> = term.chars().collect();
    let len = term_chars.len();

    for i in 1..len {
        let left: String = term_chars[..i].iter().collect();
        let right: String = term_chars[i..].iter().collect();

        if let Some((ls, mut lp)) = fuzzy_match_single_term(&left, &title_lower) {
            if let Some((rs, rp)) = fuzzy_match_single_term(&right, &title_lower) {
                let base_score = ls + rs;
                lp.extend(rp);
                return Some((base_score - 10, lp));
            }
        }
    }

    None
}

/// Search snippets by query. Empty/whitespace query returns all in input order.
pub fn search(query: &str, snippets: &[(i64, String, bool)]) -> Vec<SearchResult> {
    if query.trim().is_empty() {
        return snippets
            .iter()
            .map(|(id, title, is_encrypted)| SearchResult {
                id: *id,
                title: title.clone(),
                score: 0,
                matched_positions: vec![],
                is_encrypted: *is_encrypted,
            })
            .collect();
    }

    let mut results: Vec<SearchResult> = snippets
        .iter()
        .filter_map(|(id, title, is_encrypted)| {
            fuzzy_match(query, title).map(|(score, positions)| SearchResult {
                id: *id,
                title: title.clone(),
                score,
                matched_positions: positions,
                is_encrypted: *is_encrypted,
            })
        })
        .collect();

    results.sort_by(|a, b| b.score.cmp(&a.score));
    results
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snippets(items: &[(i64, &str, bool)]) -> Vec<(i64, String, bool)> {
        items.iter().map(|(id, t, e)| (*id, t.to_string(), *e)).collect()
    }

    // === fuzzy_match_single_term ===

    #[test]
    fn test_single_term_exact_match() {
        let result = fuzzy_match_single_term("hello", "hello");
        assert!(result.is_some());
        let (score, positions) = result.unwrap();
        assert_eq!(positions, vec![0, 1, 2, 3, 4]);
        assert_eq!(score, 50);
    }

    #[test]
    fn test_single_term_subsequence() {
        let result = fuzzy_match_single_term("hlo", "hello");
        assert!(result.is_some());
        let (score, positions) = result.unwrap();
        assert_eq!(positions.len(), 3);
        assert_eq!(score, 30);
        // h=0, l=2 (first l), o=4
        assert_eq!(positions[0], 0);
        assert_eq!(positions[2], 4);
    }

    #[test]
    fn test_single_term_no_match() {
        let result = fuzzy_match_single_term("xyz", "hello");
        assert!(result.is_none());
    }

    #[test]
    fn test_single_term_partial_no_match() {
        // 'h' found but 'z' not found after it
        let result = fuzzy_match_single_term("hz", "hello");
        assert!(result.is_none());
    }

    // === fuzzy_match ===

    #[test]
    fn test_case_insensitive_match() {
        let result = fuzzy_match("HELLO", "hello world");
        assert!(result.is_some());
    }

    #[test]
    fn test_multi_term_and_logic() {
        let result = fuzzy_match("pro prd", "prompt prd analize");
        assert!(result.is_some());
    }

    #[test]
    fn test_multi_term_and_logic_reversed() {
        let result = fuzzy_match("pro prd", "prd add-req prompt");
        assert!(result.is_some());
    }

    #[test]
    fn test_multi_term_one_missing() {
        let result = fuzzy_match("pro xyz", "prompt prd analize");
        assert!(result.is_none());
    }

    #[test]
    fn test_fallback_split_proprd() {
        let result = fuzzy_match("proprd", "prompt prd analize");
        assert!(result.is_some());
    }

    #[test]
    fn test_fallback_score_penalty() {
        // "proprd" cannot directly match "prd add-req prompt" as a subsequence
        // (after p=0,r=1,o=14,p=16 there is no 'r' left → direct match fails → fallback).
        // Fallback: "pro"+"prd" both match → base=30+30=60, penalty=-10 → 50.
        // Direct "pro prd": "pro"=30 + "prd"=30 = 60. Difference must be exactly 10.
        let direct = fuzzy_match("pro prd", "prd add-req prompt").unwrap();
        let fallback = fuzzy_match("proprd", "prd add-req prompt").unwrap();
        assert_eq!(direct.0 - fallback.0, 10);
    }

    #[test]
    fn test_fallback_uses_first_successful_split() {
        // "abc" → tries "a"+"bc" first; result is stable across calls
        let r1 = fuzzy_match("abc", "abcabc");
        let r2 = fuzzy_match("abc", "abcabc");
        assert_eq!(r1, r2);
    }

    #[test]
    fn test_no_fallback_for_multi_term() {
        // "pro xyz" has a space → AND logic only, no fallback
        let result = fuzzy_match("pro xyz", "prompt prd analize");
        assert!(result.is_none());
    }

    #[test]
    fn test_no_match_returns_none() {
        let result = fuzzy_match("xyz", "hello world");
        assert!(result.is_none());
    }

    // === search ===

    #[test]
    fn test_empty_query_returns_all() {
        let items = snippets(&[(1, "alpha", false), (2, "beta", true)]);
        let results = search("", &items);
        assert_eq!(results.len(), 2);
        assert_eq!(results[0].id, 1);
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
        let items = snippets(&[(1, "abcdef", false), (2, "abc", false)]);
        let results = search("abc", &items);
        assert!(results[0].score >= results.last().unwrap().score);
    }

    #[test]
    fn test_search_no_results() {
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
        let items = snippets(&[(1, "alpha", false)]);
        let results = search("   ", &items);
        assert_eq!(results.len(), 1);
    }
}
