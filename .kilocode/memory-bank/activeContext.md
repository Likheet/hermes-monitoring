# Active Context: Hermes Resort Task Management System

## Current Work Focus

### Primary Development Areas
- **Schema Standardization**: Resolving database schema drift between migration versions
- **Mobile PWA Enhancement**: Improving offline capabilities and performance
- **Real-time Performance**: Optimizing Supabase subscriptions for better responsiveness
- **Quality Assurance**: Strengthening photo verification and rating workflows

### Recent Changes

#### Database Schema Updates
- Identified multiple conflicting migration versions in `scripts/` directory
- TypeScript types expecting lowercase status enums while older migrations use uppercase
- Column name mismatches between legacy and current schemas
- Need to standardize on canonical schema from `01-create-schema.sql`
- REFER ACTUAL SUPABASE IMPLEMENTATION USING SUPABASE MCP FOR UPDATED INFO

#### Performance Improvements
- Implemented connection pooling for Supabase client
- Added query optimization for task lists
- Enhanced photo upload compression and resizing
- Improved service worker caching for offline mode

#### UI/UX Enhancements
- Redesigned mobile navigation with bottom tab bars
- Implemented skeleton loading states for better perceived performance
- Added progressive web app installation prompts
- Enhanced error boundaries with better user feedback

## Next Steps

### Immediate Priorities (Next 2-4 weeks)
1. **Schema Resolution**
   - Audit live Supabase instance to confirm current schema
   - Standardize on canonical migration version
   - Update TypeScript types to match live schema
   - Test all database functions with current column names

2. **Performance Optimization**
   - Implement database query optimization
   - Add React.memo for expensive component renders
   - Optimize photo upload with compression
   - Implement virtual scrolling for large task lists

3. **Feature Enhancement**
   - Complete offline task management capabilities
   - Implement push notifications for task assignments
   - Add task templates for common operations
   - Enhance reporting and analytics dashboard

4. **Testing & Quality**
   - Implement automated testing for mobile devices
   - Add end-to-end task workflow testing
   - Performance testing on slow networks
   - Accessibility testing for compliance

### Technical Debt Resolution
- **Schema Migration**: Create definitive migration path from legacy to current schema
- **Function Updates**: Update all PostgreSQL functions to use current column names
- **Type Safety**: Resolve all TypeScript type mismatches
- **Documentation**: Update all API documentation to reflect current state

## Active Decisions

### Architecture Decisions
- **Dual Timestamp Strategy**: Maintaining client/server timestamp validation for audit trail
- **Real-time First**: Prioritizing Supabase realtime over polling for updates
- **Mobile-First**: Designing primarily for mobile workers with desktop as secondary
- **Component Library**: Using Radix UI with custom components for consistency
- **State Management**: React Context for global state, local state for component-specific data

### Implementation Patterns
- **Feature Flags**: Using environment variables for gradual feature rollout
- **Error Boundaries**: Implementing at component and page level for graceful failures
- **Progressive Enhancement**: PWA capabilities with offline-first approach
- **Audit Logging**: Comprehensive logging for all state changes with metadata

## Important Patterns

### Code Organization
- **Feature-Based Structure**: Components organized by domain (worker, supervisor, front-office, admin)
- **Shared Utilities**: Common functions in `lib/` for reusability
- **Type Safety**: Strict TypeScript configuration with comprehensive type definitions
- **Custom Hooks**: Extracting common state logic into reusable hooks

### Database Patterns
- **Soft Deletes**: Using archived_tasks table for historical data
- **Audit Trail**: Comprehensive logging in audit_logs table
- **Row Level Security**: All tables have appropriate RLS policies
- **Indexing Strategy**: Performance-optimized indexes for common query patterns

### Performance Patterns
- **Lazy Loading**: Code splitting and dynamic imports for better initial load
- **Connection Reuse**: Supabase client with proper connection management
- **Caching Strategy**: React Query for client-side data caching
- **Image Optimization**: Compression and CDN delivery for all photos

## Project Insights

### Development Learnings
- **Schema Drift is Critical**: Multiple migration versions causing runtime errors
- **Mobile Testing is Essential**: Desktop testing insufficient for resort environment
- **Real-time Complexity**: Supabase subscriptions require careful state management
- **Photo Storage Costs**: Need monitoring and optimization for large deployments

### User Feedback Integration
- **Worker Feedback**: Timer accuracy and photo quality are primary concerns
- **Supervisor Needs**: Efficient verification workflow with mobile-friendly interface
- **Front Office Requirements**: Quick task creation with intuitive assignment interface
- **Admin Priorities**: User management and reporting capabilities are most requested

### Performance Considerations
- **Network Variability**: Resort Wi-Fi can be unreliable, requiring robust offline mode
- **Device Constraints**: Workers use older mobile devices with limited storage
- **Concurrent Users**: System must handle 500+ users during peak shifts
- **Photo Upload**: Large photo batches can timeout on poor connections

## Preferences

### Development Approach
- **Incremental Delivery**: Small, frequent releases with feature flags
- **Mobile-First Testing**: All features tested on actual worker devices
- **Performance Monitoring**: Continuous monitoring of database and API response times
- **User-Centric Design**: All decisions based on worker workflow optimization

### Code Quality Standards
- **Type Safety**: No any types, strict TypeScript configuration
- **Error Handling**: Comprehensive error boundaries with user-friendly messages
- **Testing**: Manual testing required before feature deployment
- **Documentation**: All changes documented with reasoning and impact

### Deployment Strategy
- **Environment Parity**: Staging environment must match production
- **Rollback Capability**: Quick rollback plan for failed deployments
- **Monitoring**: Comprehensive alerting for system health issues
- **Backup Strategy**: Regular database backups with point-in-time recovery
