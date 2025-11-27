# CodeReview App Test Cases

## Test Suite Overview
This document outlines test cases to ensure the CodeReview app works correctly.

## 1. Initial Load Tests

### Test 1.1: App Loads Successfully
- **Given**: User opens the app
- **When**: Page loads
- **Then**: 
  - Loading spinner is displayed
  - App eventually shows a code snippet
  - No errors in console

### Test 1.2: Default Mode is "Brand New"
- **Given**: User opens the app
- **When**: Page loads
- **Then**: "Brand New" mode button is active/selected

## 2. Snippet Fetching Tests

### Test 2.1: Fetch Single Snippet
- **Given**: App is loaded
- **When**: User clicks "Next Snippet" button
- **Then**:
  - Loading state is shown briefly
  - New code snippet is displayed
  - Snippet contains: repository, file path, code content, language, line numbers
  - URL to GitHub is valid

### Test 2.2: Fetch from Cache
- **Given**: App has cached snippets
- **When**: User clicks "Next Snippet"
- **Then**:
  - Snippet displays immediately (no loading delay)
  - Cache count decreases
  - New snippet is preloaded in background

### Test 2.3: Fetch When Cache Empty
- **Given**: Cache is empty
- **When**: User clicks "Next Snippet"
- **Then**:
  - Loading state is shown
  - New snippet is fetched from API
  - Snippet is displayed
  - Cache starts refilling

## 3. Mode Switching Tests

### Test 3.1: Switch to Curated Mode
- **Given**: App is in "Brand New" mode
- **When**: User clicks "Curated" button
- **Then**:
  - Mode switches to "Curated"
  - New snippet is fetched from curated repositories
  - Button shows active state

### Test 3.2: Switch to Brand New Mode
- **Given**: App is in "Curated" mode
- **When**: User clicks "Brand New" button
- **Then**:
  - Mode switches to "Brand New"
  - New snippet is fetched from new/trending repositories
  - Button shows active state

## 4. Cache Management Tests

### Test 4.1: Cache Preloading
- **Given**: App is running
- **When**: Cache has less than 5 snippets
- **Then**:
  - Background preloading starts automatically
  - Cache count increases
  - No UI blocking during preload

### Test 4.2: Cache Usage
- **Given**: Cache has multiple snippets
- **When**: User clicks "Next Snippet" multiple times
- **Then**:
  - Snippets display instantly from cache
  - Cache count decreases appropriately
  - Preloading refills cache when low

## 5. Commit Information Tests

### Test 5.1: Display Commit Author
- **Given**: Snippet has commit information
- **When**: Snippet is displayed
- **Then**:
  - Commit author name is shown
  - Author GitHub link is clickable (if available)
  - Format: "👤 Author Name (@username)"

### Test 5.2: Display Commit Date
- **Given**: Snippet has commit information
- **When**: Snippet is displayed
- **Then**:
  - Commit date is shown
  - Date is formatted: "📅 Month Day, Year, Time"
  - Date is recent (for "Brand New" mode)

## 6. Error Handling Tests

### Test 6.1: API Error Handling
- **Given**: API returns an error
- **When**: Fetching snippet
- **Then**:
  - Error message is displayed to user
  - "Try Again" button is shown
  - App doesn't crash

### Test 6.2: Network Error Handling
- **Given**: Network connection is lost
- **When**: Fetching snippet
- **Then**:
  - Error message is displayed
  - User can retry
  - App remains functional

### Test 6.3: Rate Limit Handling
- **Given**: GitHub API rate limit is reached
- **When**: Fetching snippet
- **Then**:
  - Appropriate error message is shown
  - App suggests adding GITHUB_TOKEN
  - App doesn't crash

## 7. Review Functionality Tests

### Test 7.1: Submit Review
- **Given**: Code snippet is displayed
- **When**: User submits a review
- **Then**:
  - Review form accepts: name, comment, smell type, severity
  - Review is saved to database
  - Review appears in reviews list
  - Form resets after submission

### Test 7.2: Vote on Review
- **Given**: Review exists
- **When**: User votes (agree/disagree)
- **Then**:
  - Vote is recorded
  - Vote count updates
  - User can only vote once per review (or with name)

## 8. UI/UX Tests

### Test 8.1: Loading States
- **Given**: App is fetching data
- **When**: Loading
- **Then**:
  - Loading spinner is visible
  - Buttons are disabled during load
  - Clear loading message is shown

### Test 8.2: Responsive Design
- **Given**: App is open
- **When**: Window is resized
- **Then**:
  - Layout adapts to screen size
  - Code blocks are scrollable
  - Navigation remains accessible

### Test 8.3: Dark Mode
- **Given**: System is in dark mode
- **When**: App loads
- **Then**:
  - Dark theme is applied
  - Text is readable
  - Colors have sufficient contrast

## 9. Performance Tests

### Test 9.1: Fast Snippet Switching
- **Given**: Cache has snippets
- **When**: User rapidly clicks "Next Snippet"
- **Then**:
  - Snippets switch instantly
  - No lag or stuttering
  - Cache refills appropriately

### Test 9.2: Memory Management
- **Given**: App runs for extended period
- **When**: User reviews many snippets
- **Then**:
  - Memory usage remains reasonable
  - No memory leaks
  - Cache doesn't grow unbounded

## 10. Integration Tests

### Test 10.1: Database Integration
- **Given**: Snippet is fetched
- **When**: Snippet is saved
- **Then**:
  - Snippet is stored in database
  - Reviews are linked to snippets
  - Votes are linked to reviews

### Test 10.2: GitHub API Integration
- **Given**: Valid GITHUB_TOKEN
- **When**: Fetching snippets
- **Then**:
  - API calls succeed
  - Rate limits are respected
  - Code is fetched correctly

## 11. Edge Cases

### Test 11.1: Empty Repository
- **Given**: Repository has no code files
- **When**: Fetching snippet
- **Then**:
  - App skips to next repository
  - No error is shown
  - Eventually finds valid snippet

### Test 11.2: Very Large Files
- **Given**: Repository has very large files
- **When**: Fetching snippet
- **Then**:
  - Large files are skipped
  - Only appropriate sized snippets are shown
  - App doesn't hang

### Test 11.3: Invalid File Types
- **Given**: Repository has non-code files
- **When**: Fetching snippet
- **Then**:
  - Only code files are selected
  - File extensions are recognized
  - Language is detected correctly

## 12. Navigation Tests

### Test 12.1: Rankings Page
- **Given**: App is open
- **When**: User clicks "Rankings" button
- **Then**:
  - Rankings page loads
  - Shows top reviewers
  - Shows top projects

### Test 12.2: GitHub Link
- **Given**: Snippet is displayed
- **When**: User clicks "View on GitHub"
- **Then**:
  - Opens correct GitHub URL
  - URL includes correct file path
  - URL includes correct line numbers

### Test 12.3: Open PR Link
- **Given**: Snippet is displayed
- **When**: User clicks "Open PR"
- **Then**:
  - GitHub PR creation page opens
  - PR body includes snippet context
  - PR body includes reviews (if any)

## Manual Testing Checklist

- [ ] App starts without errors
- [ ] First snippet loads successfully
- [ ] "Next Snippet" button works
- [ ] Mode switching works (Curated/Brand New)
- [ ] Cache preloading works
- [ ] Commit info displays (when available)
- [ ] Review submission works
- [ ] Voting works
- [ ] Error handling works
- [ ] Rankings page loads
- [ ] GitHub links work
- [ ] PR creation link works
- [ ] Dark mode works
- [ ] Responsive design works
- [ ] No console errors
- [ ] No memory leaks after extended use

## Automated Testing Recommendations

1. **Unit Tests**: Test individual functions (scoring, pattern detection)
2. **Integration Tests**: Test API routes
3. **E2E Tests**: Test full user flows (Playwright/Cypress)
4. **Performance Tests**: Test cache efficiency, API call optimization
5. **Error Boundary Tests**: Test error handling paths

