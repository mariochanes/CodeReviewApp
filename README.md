# CodeReview - StumbleUpon for Code Review

A fun application that lets you review random code snippets from GitHub, vote on reviews, and see rankings of reviewers and projects based on code quality.

## Features

- 🎲 **Random Code Snippets**: Get random code snippets from popular GitHub repositories
- 💬 **Code Reviews**: Review code snippets and identify code smells, bugs, or good practices
- 👍👎 **Voting System**: Vote on reviews to show agreement/disagreement
- 📊 **Rankings**: 
  - Top reviewers based on agreement ratio
  - Top projects based on code quality scores
- 🔗 **Open PR**: Create a pull request directly from the review page
- 🏆 **Project Quality Scores**: Projects are ranked based on review consensus

## Getting Started

### Prerequisites

- Node.js 18+ installed
- npm or yarn

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and optionally add your GitHub token for higher rate limits:
```
GITHUB_TOKEN=your_github_token_here
```

3. Set up the database:
```bash
npx prisma db push
```

4. Run the development server:
```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Usage

1. **Review Code**: Click "Next Snippet" to get a random code snippet from GitHub
2. **Add Review**: Click "Add Review" to leave a review with your name, comment, smell type, and severity
3. **Vote**: Click 👍 or 👎 on reviews to agree or disagree (you'll be prompted for your name)
4. **Open PR**: Click "Open PR" to create a pull request on GitHub
5. **View Rankings**: Click "Rankings" to see top reviewers and projects

## Tech Stack

- **Next.js 14** - React framework with App Router
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Prisma** - Database ORM
- **SQLite** - Database (easy to switch to PostgreSQL for production)
- **GitHub API** - Fetching code snippets

## Project Structure

```
CodeReviewApp/
├── app/
│   ├── api/          # API routes
│   ├── rankings/     # Rankings page
│   ├── layout.tsx    # Root layout
│   ├── page.tsx      # Home page
│   └── globals.css   # Global styles
├── components/       # React components
├── lib/             # Utilities (Prisma, GitHub API)
├── prisma/          # Database schema
└── public/          # Static assets
```

## Deployment

For production deployment (e.g., Hostinger):

1. Build the application:
```bash
npm run build
```

2. Update `DATABASE_URL` in `.env` to use PostgreSQL instead of SQLite

3. Run migrations:
```bash
npx prisma migrate deploy
```

4. Start the production server:
```bash
npm start
```

## License

MIT

