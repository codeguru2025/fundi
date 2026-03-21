# Lumina Wealth - Books & Courses Platform

## Overview

Lumina Wealth is a web application for generating passive income through ebook publishing and online courses. Users upload manuscripts (DOCX, PDF, TXT, EPUB, HTML) or create courses with video/text lessons, customize metadata, and publish to an integrated marketplace. Includes Paynow payment integration (web, Ecocash, OneMoney), automated ebook conversion pipeline (to EPUB via Calibre/Pandoc), and a Kindle-like EPUB reader with epub.js. Philosophy: "Make money while you sleep."

## User Preferences

Preferred communication style: Simple, everyday language.

## Monetization Model
- First book/course free, $25 upload fee for subsequent content
- $10/month subscription to keep content active
- 25% platform commission on sales
- Weekly settlements with $50 minimum threshold
- Sellers read/watch their own content free
- Buyers access purchased content offline (PWA)
- **Admin accounts bypass all fees**: No upload fees, no subscription fees, auto-approved content

## Contact Details
- **Phone (Calls)**: 0773 665 350
- **WhatsApp**: 0712 171 267

## Featured Books
- "Reflections of a Relentless Hustler" - prominently featured on landing page
- "Making Money While Sleeping" - prominently featured on landing page

## Branding
- Footer: "Created by Chibikhulu" with dolphin logo (chibikhulu-logo.jpeg in public/)
- **Academy Founder**: Augustus Siziba - "Founder & Director of Education"
- All certificates (PDF and on-screen) display Augustus Siziba's cleaned signature, name, and title
- Signature image: server/assets/signature-clean.png (transparent PNG, also in client/public/)
- Certificate PDF: Generated with pdf-lib, includes QR code, gold borders, signature, logo, and verification URL
- Certificate uses student's real first+last name from Google OAuth profile
- Course levels: Certificate, Advanced Certificate, Diploma, Advanced Diploma, Professional Certificate, Executive Programme
- Book categories: Fiction, Non-Fiction, Business, Self-Help, Biography, Romance, Sci-Fi, Fantasy, Mystery, Thriller, History, Finance, Health, Technology, Poetry, Religion, Design, Lifestyle, Other
- Course categories: Business, Entrepreneurship, Technology, Marketing, Finance, Personal Development, Leadership, Education, Design, Health & Wellness, Science, Law, Engineering, Agriculture, Real Estate, Cryptocurrency, Sales, Communication, Other

## Admin & Content Moderation
- **Default admin**: ausiziba@gmail.com (set via DEFAULT_ADMIN_EMAIL env var)
- Admin accounts bypass upload fees ($25) and subscription fees ($10/month)
- Admin-published content is auto-approved (no review needed)
- All non-admin content requires admin approval before appearing in store
- Books and courses have `isApproved` and `adminComment` fields
- Admin can approve/reject with feedback comments for publishers to fix and resubmit
- Admin can toggle visibility of any published book or course
- Content Moderation tab in admin dashboard manages pending approvals and visibility
- Publishers see approval status and admin feedback on their dashboard

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Routing**: Wouter (lightweight React router)
- **State Management**: TanStack React Query for server state, React Context for local state (ProjectProvider)
- **Styling**: Tailwind CSS v4 with custom literary theme (warm paper tones, library blue accents)
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Build Tool**: Vite with custom plugins for Replit integration
- **PWA**: Service worker with offline caching, install prompt, animated splash screen

### Backend Architecture
- **Framework**: Express.js 5 running on Node.js
- **API Design**: RESTful JSON API with `/api` prefix
- **Server Architecture**: Single HTTP server serving both API and static files
- **Development Mode**: Vite dev server middleware with HMR support
- **Production Mode**: Static file serving from `dist/public`

### Data Storage
- **Database**: PostgreSQL via Drizzle ORM
- **Schema Location**: `shared/schema.ts` (shared between client and server)
- **Migrations**: Drizzle Kit with `drizzle-kit push` for schema synchronization
- **Connection**: Connection pool via `pg` package

### Database Schema
- **users**: User accounts with admin flags and Paynow integration credentials
- **books**: Published books with metadata, pricing, subscription status, ebook conversion fields (originalFileUrl, epubFileUrl, originalFormat, conversionStatus)
- **sales**: Transaction records linking buyers to books/courses
- **settlements**: Weekly payout settlements for sellers
- **paynowConfig**: Platform-wide payment gateway configuration
- **pendingPayments**: Book payment tracking with Paynow pollUrl
- **purchases**: Records of completed book purchases
- **courses**: Published courses with metadata, pricing, subscription status
- **modules**: Course modules (sections) with ordering
- **lessons**: Individual lessons within modules (video/text/image content)
- **quizzes**: Revision exercises and module progress tests
- **quizQuestions**: Multiple-choice questions for quizzes
- **quizAttempts**: User quiz attempt records with scores
- **labs**: Optional hands-on lab exercises per course
- **labSubmissions**: User lab completion records
- **certificates**: Verifiable completion certificates with QR tokens
- **coursePurchases**: Records of completed course purchases
- **coursePendingPayments**: Course payment tracking with Paynow pollUrl
- **lessonProgress**: Tracks which lessons users have completed
- **pageViews**: Analytics tracking for page views, content views, sessions

### Authentication
- **Google OAuth 2.0**: Authentication via Google using passport-google-oauth20
- **Session Management**: PostgreSQL-backed sessions with connect-pg-simple
- **Session Security**: Requires SESSION_SECRET env var, sameSite='lax', secure in production
- **Role-Based Access**: isAuthenticated and isAdmin middleware protect routes
- **Google OAuth Setup**: Requires GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET secrets
- **Callback URL**: `/api/auth/google/callback` (must be registered in Google Cloud Console)

### Key Pages
- **/** - Home page with CTA for books and courses
- **/store** - Book marketplace
- **/courses** - Course marketplace
- **/editor** - Book upload/publish wizard
- **/create-course** - Course creation wizard with module/lesson/quiz/lab editor
- **/book/:id** - Book detail/product page with Paynow purchase
- **/course/:id** - Course detail/product page with Paynow purchase
- **/read/:id** - Book reader with swipe gestures, progress tracking
- **/course/:id/learn** - Course player with lesson viewer, quizzes, labs, certificate
- **/verify/:token** - Public certificate verification page
- **/admin** - Admin dashboard for sales, settlements, books management
- **/dashboard** - Publisher dashboard with publications, sales, revenue, analytics

### Key Design Patterns
- **Shared Types**: Schema definitions in `shared/` folder used by both client and server
- **Storage Interface**: `IStorage` interface abstracts database operations for testability
- **Commission Model**: 25% platform commission, $25 upload fee, $10 monthly subscription
- **Weekly Settlements**: Automated settlement generation with $50 minimum threshold
- **Paynow Payment Flow**: Creates pending payment → webhook verifies with Paynow API using paid() method → creates sale + purchase → marks payment completed
- **File Uploads**: Two upload paths available:
  - Small files (images, docs): POST /api/upload via Multer → server streams to object storage
  - Large files (videos): POST /api/upload/request-signed-url → client uploads directly to signed cloud URL (bypasses server memory)
  - VideoRecorder component for in-app recording with camera/screen/OBS device selection
  - Object storage serves files at /objects/* with HTTP Range request support for video seeking
- **Honor Code**: Coursera-style honor code checkbox required before certificate generation
- **Video Playback**: Native HTML5 video for uploaded/direct files, iframe for YouTube/Vimeo embeds
- **Certificate Payment**: $100 USD fee required to download certificate; verification token withheld until paid; Paynow payment flow for certificates
- **Certificate Security**: Verification tokens redacted from API responses until payment confirmed; verify endpoint rejects unpaid certificates
- **Ebook Conversion Pipeline**: Upload triggers background conversion via Calibre (primary) or Pandoc (fallback); status tracked in DB (none→pending→processing→completed/failed); polls every 3s during conversion; EPUB files skip conversion
- **EPUB Reader**: epub.js-based reader with light/sepia/dark themes, font size/family controls, chapter TOC, in-book search, bookmarks, reading position persistence, swipe navigation, fullscreen mode

## Security & Data Integrity
- **Payment Atomicity**: confirmBookPayment/confirmCoursePayment wrap sale+purchase+pending-status in single DB transaction
- **Purchase Deduplication**: Unique indexes on purchases(bookId,buyerToken) and coursePurchases(courseId,buyerToken); runtime idempotency checks inside transactions
- **CSRF Protection**: Logout uses POST (not GET); frontend uses fetch POST for logout
- **Input Validation**: Zod schemas on profile update, become-seller, payment initiation (field lengths, email format, paymentMethod enum)
- **Secret Stripping**: stripSensitiveUserFields() removes paynowIntegrationKey from all user API responses
- **File Upload Security**: Multer fileFilter requires BOTH file extension AND MIME type match against strict allowlists
- **Rate Limiting**: Payment initiation (10/min), check-status (30/min), analytics (30/min) per-IP
- **React ErrorBoundary**: Wraps entire app to catch and display rendering errors gracefully

## Scalability & Performance
- **Database Indexes**: All 20 tables have targeted indexes on frequently queried columns (foreign keys, status fields, composite lookups)
- **SQL Aggregations**: Admin overview, dashboard, settlements all use SQL SUM/COUNT/GROUP BY instead of loading rows into JS
- **Content Count Queries**: getUserContentCount() uses SQL COUNT instead of loading all books/courses for first-content-free checks
- **Pagination**: /api/books and /api/courses support ?page=&pageSize=&search=&category= (backward compatible: no params = full array)
- **Admin Overview**: Uses parallel SQL aggregate queries, never loads full tables; paginated book/course/settlement lists
- **Dashboard**: Batch queries for course purchase counts and seller sales (single GROUP BY, no N+1)
- **Settlement Generation**: Uses SQL GROUP BY for seller earnings aggregation

## External Dependencies

### Payment Integration
- **Paynow**: Zimbabwe payment gateway (web, Ecocash, OneMoney)
- Platform-level PAYNOW_INTEGRATION_ID and PAYNOW_INTEGRATION_KEY secrets
- Callback URLs: `/api/payments/callback` (books), `/api/courses/payments/callback` (courses)

### Third-Party Services
- **Google Fonts**: Libre Baskerville (serif) and Inter (sans-serif) for typography

### Key NPM Packages
- **drizzle-orm** / **drizzle-zod**: Type-safe ORM with Zod schema generation
- **@tanstack/react-query**: Server state management and caching
- **react-easy-crop**: Image cropping for book covers
- **framer-motion**: Page animations and transitions
- **wouter**: Lightweight client-side routing
- **zod**: Runtime schema validation
- **paynow**: Zimbabwe payment gateway SDK
- **passport-google-oauth20**: Google OAuth strategy
- **multer**: File upload handling for course lesson media

### Build and Development
- **esbuild**: Server bundling with selective dependency bundling for cold start optimization
- **Vite**: Frontend build with React plugin, Tailwind CSS, and Replit-specific plugins
- **tsx**: TypeScript execution for development server
