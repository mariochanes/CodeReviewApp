# Console Monitoring Checklist

## Browser Console (F12) - Things to Watch For

### ✅ Normal/Expected Logs
- `[Client] Pre-loading snippets (mode: new, current cache: 0)...`
- `[Client] Using cached snippet (score: X). Y remaining in cache.`
- `[Client] Cached X snippets. Total in cache: Y`
- `[Client] Successfully loaded snippet: repository-name`

### ⚠️ Warning Signs
1. **Infinite Loops**
   - Same log message repeating rapidly
   - Cache count not increasing
   - "Pre-loading" messages every second

2. **Error Patterns**
   - `Failed to fetch snippet` appearing repeatedly
   - `500 Internal Server Error` in network tab
   - `403 Rate Limit` errors from GitHub API
   - `Network error` messages

3. **Performance Issues**
   - Too many API calls in short time
   - Cache not being used (always showing "Cache empty")
   - Loading states never completing

4. **State Issues**
   - Snippets not displaying
   - Mode switching not working
   - Buttons not responding

### 🔍 What to Check

1. **Network Tab (F12 → Network)**
   - Check `/api/snippets/random` calls
   - Check `/api/snippets/batch` calls
   - Look for failed requests (red)
   - Check response times

2. **Console Tab (F12 → Console)**
   - Look for errors (red)
   - Check for warnings (yellow)
   - Monitor log frequency

3. **Application Behavior**
   - Does first snippet load?
   - Does "Next Snippet" work?
   - Does mode switching work?
   - Does cache count increase?
   - Are snippets displaying correctly?

### 🐛 Common Issues to Report

1. **App stuck on loading**
   - Check if API calls are failing
   - Check if GitHub token is valid

2. **Snippets not loading**
   - Check network tab for errors
   - Check console for error messages

3. **Cache not working**
   - Check if preload is running
   - Check if cache count increases

4. **Mode switching issues**
   - Check if API calls change mode
   - Check if UI updates correctly

## Server Console (Terminal) - Things to Watch For

### ✅ Normal Logs
- `Ready on http://localhost:3000`
- `Fetching random code snippet (mode: ...)`
- `Fetched snippet from ...`

### ⚠️ Warning Signs
1. **GitHub API Issues**
   - Rate limit errors
   - 403 Forbidden errors
   - Network timeout errors

2. **Database Issues**
   - Prisma connection errors
   - SQL errors

3. **Build/Compilation Issues**
   - TypeScript errors
   - Module not found errors

