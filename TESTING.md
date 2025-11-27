# Testing Guide

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npm test -- __tests__/app.test.tsx
```

## Running the App

### Development Mode
```bash
npm run dev
```
Opens at `http://localhost:3000`

### Production Build
```bash
npm run build
npm start
```

### Database Setup
```bash
npm run db:push
```

## Test Structure

Tests are located in the `__tests__/` directory:

- `__tests__/app.test.tsx` - Main page component tests
- `__tests__/components/CodeSnippet.test.tsx` - Code snippet component tests
- `__tests__/api/snippets-random.test.ts` - API route tests
- `__tests__/lib/github.test.ts` - GitHub API function tests

## Test Coverage

Current test coverage includes:
- ✅ Component rendering
- ✅ User interactions (button clicks, form submissions)
- ✅ API route handling
- ✅ Error states
- ✅ Loading states
- ✅ Mode switching

## Writing New Tests

When adding new features, create corresponding test files:

1. **Component Tests**: Test user interactions and rendering
2. **API Tests**: Test request/response handling
3. **Utility Tests**: Test helper functions

Example test structure:
```typescript
import { render, screen } from '@testing-library/react'
import '@testing-library/jest-dom'
import MyComponent from '@/components/MyComponent'

describe('MyComponent', () => {
  test('renders correctly', () => {
    render(<MyComponent />)
    expect(screen.getByText('Expected Text')).toBeInTheDocument()
  })
})
```

## Troubleshooting

### Tests failing with "Request is not defined"
- This is a known issue with Next.js API route testing
- The mock is set up in the test file, but may need adjustment for your environment

### "act()" warnings
- These are warnings, not errors
- They occur when state updates happen outside of React's act() wrapper
- Tests still pass, but you can wrap state updates in `act()` to silence warnings

### Mock issues
- Ensure mocks are set up before imports
- Clear mocks in `beforeEach` hooks
- Check that mock implementations match actual function signatures

