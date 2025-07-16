#!/bin/bash

# Zero-Disruption RAG Migration Deployment Script
# Safely deploys RAG-enhanced agents to production

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_FILE="${SCRIPT_DIR}/logs/rag-migration-$(date +%Y%m%d-%H%M%S).log"
BACKUP_DIR="${SCRIPT_DIR}/backups/pre-rag-migration-$(date +%Y%m%d-%H%M%S)"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"
mkdir -p "$BACKUP_DIR"

# Logging function
log() {
    local level=$1
    shift
    local message="$*"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    
    case $level in
        INFO)  echo -e "${GREEN}[INFO]${NC}  $timestamp - $message" | tee -a "$LOG_FILE" ;;
        WARN)  echo -e "${YELLOW}[WARN]${NC}  $timestamp - $message" | tee -a "$LOG_FILE" ;;
        ERROR) echo -e "${RED}[ERROR]${NC} $timestamp - $message" | tee -a "$LOG_FILE" ;;
        DEBUG) echo -e "${BLUE}[DEBUG]${NC} $timestamp - $message" | tee -a "$LOG_FILE" ;;
    esac
}

# Error handling
handle_error() {
    local exit_code=$?
    log ERROR "Deployment failed with exit code: $exit_code"
    log ERROR "Check logs at: $LOG_FILE"
    
    # Attempt automatic rollback
    if [[ "$AUTO_ROLLBACK" == "true" ]]; then
        log WARN "Attempting automatic rollback..."
        execute_rollback
    fi
    
    exit $exit_code
}

trap handle_error ERR

# Configuration options (can be overridden via environment variables)
DRY_RUN=${DRY_RUN:-false}
AUTO_ROLLBACK=${AUTO_ROLLBACK:-true}
SKIP_BACKUP=${SKIP_BACKUP:-false}
SKIP_TESTS=${SKIP_TESTS:-false}
HEALTH_CHECK_TIMEOUT=${HEALTH_CHECK_TIMEOUT:-300}
ENVIRONMENT=${ENVIRONMENT:-production}

# Pre-deployment checks
check_prerequisites() {
    log INFO "🔍 Checking deployment prerequisites..."
    
    # Check if we're in the correct directory
    if [[ ! -f "package.json" ]] || [[ ! -d "src/agents" ]]; then
        log ERROR "Not in project root directory"
        exit 1
    fi
    
    # Check Node.js version
    if ! command -v node &> /dev/null; then
        log ERROR "Node.js not found"
        exit 1
    fi
    
    local node_version=$(node --version | cut -d'v' -f2)
    local required_version="18.0.0"
    if [[ "$(printf '%s\n' "$required_version" "$node_version" | sort -V | head -n1)" != "$required_version" ]]; then
        log ERROR "Node.js version $node_version is below required $required_version"
        exit 1
    fi
    
    # Check if application is running
    if ! pgrep -f "node.*dist/index.js" > /dev/null; then
        log WARN "Application does not appear to be running"
    fi
    
    # Check environment variables
    if [[ -z "${DATABASE_URL:-}" ]] || [[ -z "${SUPABASE_URL:-}" ]]; then
        log ERROR "Required environment variables not set"
        exit 1
    fi
    
    log INFO "✅ Prerequisites check passed"
}

# Create backup of current state
create_backup() {
    if [[ "$SKIP_BACKUP" == "true" ]]; then
        log INFO "⏭️ Skipping backup creation"
        return
    fi
    
    log INFO "💾 Creating backup of current state..."
    
    # Backup current agent files
    cp -r src/agents "$BACKUP_DIR/"
    cp -r src/services "$BACKUP_DIR/"
    
    # Backup current environment configuration
    if [[ -f ".env.production" ]]; then
        cp .env.production "$BACKUP_DIR/"
    fi
    
    # Create backup metadata
    cat > "$BACKUP_DIR/backup-metadata.json" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "git_commit": "$(git rev-parse HEAD 2>/dev/null || echo 'unknown')",
    "backup_reason": "pre-rag-migration"
}
EOF
    
    log INFO "✅ Backup created at: $BACKUP_DIR"
}

# Run tests before deployment
run_tests() {
    if [[ "$SKIP_TESTS" == "true" ]]; then
        log INFO "⏭️ Skipping tests"
        return
    fi
    
    log INFO "🧪 Running tests before deployment..."
    
    # Install dependencies if needed
    if [[ ! -d "node_modules" ]] || [[ "package.json" -nt "node_modules" ]]; then
        log INFO "📦 Installing dependencies..."
        npm ci
    fi
    
    # Run linting
    log INFO "🔍 Running linting checks..."
    npm run lint || {
        log ERROR "Linting failed"
        exit 1
    }
    
    # Run type checking
    log INFO "🔍 Running type checks..."
    npm run build || {
        log ERROR "Type checking failed"
        exit 1
    }
    
    # Run unit tests
    log INFO "🧪 Running unit tests..."
    npm test || {
        log ERROR "Unit tests failed"
        exit 1
    }
    
    # Run integration tests specifically for RAG
    if [[ -f "src/__tests__/integration/rag-integration.test.ts" ]]; then
        log INFO "🧪 Running RAG integration tests..."
        npm test -- --testPathPattern=rag-integration || {
            log ERROR "RAG integration tests failed"
            exit 1
        }
    fi
    
    log INFO "✅ All tests passed"
}

# Deploy the migration
deploy_migration() {
    log INFO "🚀 Starting RAG migration deployment..."
    
    if [[ "$DRY_RUN" == "true" ]]; then
        log INFO "🧪 DRY RUN MODE - No actual changes will be made"
        return
    fi
    
    # Build the application
    log INFO "🔨 Building application..."
    npm run build
    
    # Run the migration script
    log INFO "🔄 Executing RAG migration..."
    npx ts-node src/scripts/rag-migration.ts || {
        log ERROR "RAG migration script failed"
        exit 1
    }
    
    log INFO "✅ RAG migration deployment completed"
}

# Monitor system health after deployment
monitor_health() {
    log INFO "🔍 Monitoring system health post-deployment..."
    
    local start_time=$(date +%s)
    local timeout_time=$((start_time + HEALTH_CHECK_TIMEOUT))
    
    while [[ $(date +%s) -lt $timeout_time ]]; do
        # Check application health endpoint
        if curl -f -s "http://localhost:3000/health" > /dev/null 2>&1; then
            log INFO "✅ Health check passed"
            
            # Check RAG-specific health
            if curl -f -s "http://localhost:3000/health/ready" | grep -q '"rag":{"status":"healthy"'; then
                log INFO "✅ RAG system health check passed"
                return 0
            else
                log WARN "⚠️ RAG system not fully healthy yet, continuing to monitor..."
            fi
        else
            log WARN "⚠️ Health check failed, retrying..."
        fi
        
        sleep 10
    done
    
    log ERROR "❌ Health monitoring timeout reached"
    return 1
}

# Validate deployment success
validate_deployment() {
    log INFO "✅ Validating deployment success..."
    
    # Check agent status endpoint
    local agent_status=$(curl -s "http://localhost:3000/api/agent-status" 2>/dev/null || echo '{}')
    
    if echo "$agent_status" | grep -q '"type":"EnhancedBaseAgent"'; then
        log INFO "✅ Enhanced agents detected in status"
    else
        log ERROR "❌ Enhanced agents not detected in status"
        return 1
    fi
    
    # Test a sample request
    log INFO "🧪 Testing sample request..."
    local test_response=$(curl -s -X POST "http://localhost:3000/api/sessions" \
        -H "Content-Type: application/json" \
        -d '{
            "userInput": {
                "mentalState": "Testing RAG integration deployment",
                "sleepPattern": 7,
                "stressLevel": 5,
                "supportSystem": ["family"],
                "recentChanges": "Testing deployment",
                "currentSymptoms": ["stress"]
            }
        }' 2>/dev/null || echo '{}')
    
    if echo "$test_response" | grep -q '"success":true'; then
        log INFO "✅ Sample request test passed"
    else
        log ERROR "❌ Sample request test failed"
        return 1
    fi
    
    log INFO "✅ Deployment validation completed successfully"
}

# Execute rollback if needed
execute_rollback() {
    log WARN "🔄 Executing rollback procedure..."
    
    if [[ ! -d "$BACKUP_DIR" ]]; then
        log ERROR "❌ Backup directory not found: $BACKUP_DIR"
        return 1
    fi
    
    # Restore agent files
    cp -r "$BACKUP_DIR/agents" src/ 2>/dev/null || log WARN "Could not restore agents"
    cp -r "$BACKUP_DIR/services" src/ 2>/dev/null || log WARN "Could not restore services"
    
    # Restore environment
    if [[ -f "$BACKUP_DIR/.env.production" ]]; then
        cp "$BACKUP_DIR/.env.production" . 2>/dev/null || log WARN "Could not restore environment"
    fi
    
    # Rebuild application
    log INFO "🔨 Rebuilding application after rollback..."
    npm run build
    
    # Reset feature flags to 0%
    log INFO "🎛️ Resetting feature flags..."
    node -e "
        const { featureFlagService } = require('./dist/services/feature-flag.service');
        featureFlagService.setPercentage('rag_enhancement', 0)
            .then(() => console.log('Feature flags reset'))
            .catch(err => console.error('Failed to reset feature flags:', err.message));
    " || log WARN "Could not reset feature flags"
    
    log INFO "✅ Rollback completed"
}

# Main deployment function
main() {
    log INFO "🎯 Starting Zero-Disruption RAG Migration Deployment"
    log INFO "📋 Configuration:"
    log INFO "   - Environment: $ENVIRONMENT"
    log INFO "   - Dry Run: $DRY_RUN"
    log INFO "   - Auto Rollback: $AUTO_ROLLBACK"
    log INFO "   - Skip Backup: $SKIP_BACKUP"
    log INFO "   - Skip Tests: $SKIP_TESTS"
    log INFO "   - Log File: $LOG_FILE"
    
    # Execute deployment steps
    check_prerequisites
    create_backup
    run_tests
    deploy_migration
    monitor_health
    validate_deployment
    
    log INFO "🎉 RAG migration deployment completed successfully!"
    log INFO "📊 Summary:"
    log INFO "   - Backup Location: $BACKUP_DIR"
    log INFO "   - Log File: $LOG_FILE"
    log INFO "   - Migration Status: SUCCESS"
}

# Show usage information
show_usage() {
    cat <<EOF
Zero-Disruption RAG Migration Deployment Script

Usage: $0 [OPTIONS]

Options:
    --dry-run              Run in dry run mode (no actual changes)
    --skip-backup          Skip backup creation
    --skip-tests           Skip test execution
    --no-auto-rollback     Disable automatic rollback on failure
    --timeout SECONDS      Set health check timeout (default: 300)
    --environment ENV      Set deployment environment (default: production)
    --help                 Show this help message

Environment Variables:
    DRY_RUN               Set to 'true' for dry run mode
    AUTO_ROLLBACK         Set to 'false' to disable auto rollback
    SKIP_BACKUP          Set to 'true' to skip backup
    SKIP_TESTS           Set to 'true' to skip tests
    HEALTH_CHECK_TIMEOUT  Health check timeout in seconds
    ENVIRONMENT          Deployment environment

Examples:
    # Standard deployment
    ./deploy-rag-migration.sh
    
    # Dry run
    ./deploy-rag-migration.sh --dry-run
    
    # Skip tests and backup
    ./deploy-rag-migration.sh --skip-tests --skip-backup
    
    # Custom timeout
    ./deploy-rag-migration.sh --timeout 600

EOF
}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --skip-backup)
            SKIP_BACKUP=true
            shift
            ;;
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --no-auto-rollback)
            AUTO_ROLLBACK=false
            shift
            ;;
        --timeout)
            HEALTH_CHECK_TIMEOUT="$2"
            shift 2
            ;;
        --environment)
            ENVIRONMENT="$2"
            shift 2
            ;;
        --help)
            show_usage
            exit 0
            ;;
        *)
            log ERROR "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
done

# Execute main function
main