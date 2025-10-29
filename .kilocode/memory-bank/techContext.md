# Technical Context: Hermes Resort Task Management System

## Technology Stack

### Frontend Technologies
- **Framework**: Next.js 15.2.4 with React 19
- **Language**: TypeScript with strict type definitions
- **Styling**: Tailwind CSS 4.1.9 with custom design system
- **UI Components**: Radix UI primitives with custom component library
- **State Management**: React Context API with custom hooks
- **Forms**: React Hook Form with Zod validation
- **Charts**: Recharts for analytics and performance visualization
- **PWA**: Next PWA plugin for offline capabilities and app installation

### Backend Technologies
- **Database**: Supabase PostgreSQL with real-time subscriptions
- **Authentication**: Custom JWT-based auth with session management
- **API**: Next.js API routes with middleware protection
- **Storage**: Supabase Storage for photo management
- **Real-time**: Supabase Realtime for live task updates

### Development Tools
- **Package Manager**: pnpm for efficient dependency management
- **Code Quality**: ESLint with custom configuration
- **Type Checking**: TypeScript with strict mode enabled
- **Build System**: Next.js optimized build with image optimization disabled
- **Deployment**: Vercel with automatic deployments from main branch

## Development Setup

### Environment Requirements
- **Node.js**: Version 18+ required
- **pnpm**: Latest stable version for package management
- **Supabase CLI**: For database operations and migrations
- **VS Code**: Recommended IDE with TypeScript extensions

### Local Development
\`\`\`bash
# Install dependencies
pnpm install

# Start development server
pnpm dev

# Database operations
supabase db push    # Push schema changes
supabase db reset   # Reset local database
supabase db diff    # Compare schema changes
\`\`\`

### Environment Variables
\`\`\`env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
\`\`\`

## Technical Constraints

### Performance Requirements
- **Mobile First**: PWA must load within 3 seconds on 3G networks
- **Offline Support**: Core functionality available for 4+ hours without connection
- **Photo Storage**: 10MB limit per task with automatic cleanup
- **Concurrent Users**: Support for 500+ simultaneous active users
- **Database Response**: All queries must respond within 200ms

### Security Constraints
- **Authentication**: JWT tokens expire after 30 minutes of inactivity
- **Row Level Security**: All database tables have RLS policies enabled
- **Photo Access**: Users can only access their own uploaded photos
- **API Rate Limiting**: 100 requests per minute per user
- **Input Validation**: All user inputs validated with Zod schemas

### Browser Support
- **Modern Browsers**: Chrome 90+, Firefox 88+, Safari 14+
- **Mobile Browsers**: iOS Safari 14+, Chrome Mobile 90+
- **PWA Support**: Service Workers enabled on all modern browsers

## Key Dependencies

### Core Dependencies
\`\`\`json
{
  "next": "15.2.4",
  "react": "^19",
  "@supabase/supabase-js": "latest",
  "@supabase/ssr": "latest",
  "@radix-ui/react-dialog": "latest",
  "@radix-ui/react-toast": "latest",
  "react-hook-form": "^7.60.0",
  "zod": "3.25.76",
  "tailwindcss": "^4.1.9",
  "lucide-react": "^0.454.0"
}
\`\`\`

### Development Dependencies
\`\`\`json
{
  "@types/node": "^22",
  "@types/react": "^19",
  "eslint": "^9.38.0",
  "eslint-config-next": "15.5.6",
  "typescript": "^5"
}
\`\`\`

## Database Schema

### Key Tables
- **users**: Authentication and role management
- **tasks**: Core task tracking with dual timestamps
- **shift_schedules**: Worker scheduling with dual-shift support
- **maintenance_tasks**: Preventive maintenance tracking
- **audit_logs**: Comprehensive audit trail
- **escalations**: Overtime detection and alerts
- **notifications**: User notification system

### Critical Indexes
- `idx_tasks_assigned_to`: Fast task assignment queries
- `idx_tasks_status`: Task status filtering
- `idx_shift_schedules_worker_date`: Shift scheduling performance
- `idx_notifications_user_read`: Notification delivery optimization

## Deployment Architecture

### Vercel Configuration
- **Build Command**: `next build`
- **Output Directory**: `.next`
- **Install Command**: `pnpm install`
- **Node Version**: 18.x
- **Environment Variables**: Managed through Vercel dashboard

### CDN and Storage
- **Static Assets**: Vercel Edge Network for global distribution
- **Photos**: Supabase Storage with public bucket policies
- **Caching**: Next.js automatic optimization with cache headers

## Monitoring and Analytics

### Performance Monitoring
- **Vercel Analytics**: Built-in performance and usage metrics
- **Supabase Metrics**: Database performance and query analysis
- **Error Tracking**: Custom error boundary with reporting

### Development Workflow
1. **Feature Branches**: All development done in feature branches
2. **Pull Requests**: Required for all code changes
3. **Code Review**: Mandatory review before merging
4. **Database Migrations**: Version-controlled schema changes
5. **Testing**: Manual testing on mobile devices required

## Known Technical Debt

### Schema Drift Issues
- Multiple migration versions exist with conflicting column names
- TypeScript types expect lowercase status, older migrations use uppercase
- Some functions reference non-existent columns from newer schema
- Resolution needed: Standardize on canonical schema version

### Performance Optimizations Needed
- Photo upload compression and resizing
- Database query optimization for large task lists
- Service worker caching for offline mode
- Component lazy loading for mobile performance
