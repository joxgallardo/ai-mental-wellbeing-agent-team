#!/bin/bash

# Mass TypeScript Compilation Error Fix Script
# Targets the most common error patterns for bulk resolution

echo "🚀 Mass TypeScript Error Fix Script"
echo "===================================="

# Function to count errors
count_errors() {
    npm run build 2>&1 | grep "error TS" | wc -l | tr -d ' '
}

# Function to count specific error types
count_error_type() {
    npm run build 2>&1 | grep "$1" | wc -l | tr -d ' '
}

# Initial counts
initial_errors=$(count_errors)
initial_ts4111=$(count_error_type "TS4111")
initial_ts6133=$(count_error_type "TS6133")

echo "📊 Initial Error Counts:"
echo "  Total errors: $initial_errors"
echo "  TS4111 (Index signature): $initial_ts4111"
echo "  TS6133 (Unused variables): $initial_ts6133"
echo ""

# Step 1: Fix Index Signature Access (TS4111) - Automated
echo "🔧 Step 1: Fixing index signature access (TS4111)..."

# Common patterns to fix
find src -name "*.ts" -not -path "*/node_modules/*" -exec sed -i '' \
  -e 's/\.metadata\.methodology/\.metadata\['\''methodology'\''\]/g' \
  -e 's/\.metadata\.complexity_level/\.metadata\['\''complexity_level'\''\]/g' \
  -e 's/\.metadata\.goal_type/\.metadata\['\''goal_type'\''\]/g' \
  -e 's/\.metadata\.life_area/\.metadata\['\''life_area'\''\]/g' \
  -e 's/\.metadata\.evidence_level/\.metadata\['\''evidence_level'\''\]/g' \
  -e 's/\.metadata\.career_stage/\.metadata\['\''career_stage'\''\]/g' \
  -e 's/\.metadata\.industry/\.metadata\['\''industry'\''\]/g' \
  -e 's/\.personalization\.methodology_preference_weight/\.personalization\['\''methodology_preference_weight'\''\]/g' \
  -e 's/\.personalization\.complexity_preference_weight/\.personalization\['\''complexity_preference_weight'\''\]/g' \
  -e 's/\.personalization\.goal_alignment_weight/\.personalization\['\''goal_alignment_weight'\''\]/g' \
  -e 's/\.boost_factors\.methodology_match/\.boost_factors\['\''methodology_match'\''\]/g' \
  -e 's/\.boost_factors\.life_area_match/\.boost_factors\['\''life_area_match'\''\]/g' \
  -e 's/\.boost_factors\.evidence_level_high/\.boost_factors\['\''evidence_level_high'\''\]/g' \
  -e 's/\.boost_factors\.complexity_match/\.boost_factors\['\''complexity_match'\''\]/g' \
  -e 's/\.penalty_factors\.complexity_mismatch/\.penalty_factors\['\''complexity_mismatch'\''\]/g' \
  {} \;

# Step 2: Fix common assignment patterns
find src -name "*.ts" -not -path "*/node_modules/*" -exec sed -i '' \
  -e 's/checks\.application = /checks\['\''application'\''\] = /g' \
  -e 's/checks\.memory = /checks\['\''memory'\''\] = /g' \
  -e 's/checks\.cpu = /checks\['\''cpu'\''\] = /g' \
  -e 's/checks\.database = /checks\['\''database'\''\] = /g' \
  {} \;

after_ts4111=$(count_error_type "TS4111")
echo "  TS4111 errors: $initial_ts4111 → $after_ts4111"

# Step 3: Comment out unused imports (TS6133)
echo "🧹 Step 2: Commenting out unused imports (TS6133)..."

# Common unused import patterns in test files
find src/__tests__ -name "*.ts" -exec sed -i '' \
  -e 's/^import.*knowledgePopulationService.*$/\/\/ &/' \
  -e 's/^import.*domainConfigLoaderService.*$/\/\/ &/' \
  -e 's/^import.*lifeCoachingKnowledgeBase.*$/\/\/ &/' \
  {} \;

# Fix unused parameters by prefixing with underscore
find src -name "*.ts" -not -path "*/node_modules/*" -exec sed -i '' \
  -e 's/(\([^)]*\), ragContext: any)/(\1, _ragContext: any)/g' \
  -e 's/(\([^)]*\), context: AgentContext)/(\1, _context: AgentContext)/g' \
  -e 's/(\([^)]*\), input: UserInput)/(\1, _input: UserInput)/g' \
  -e 's/(\([^)]*\), index: number)/(\1, _index: number)/g' \
  {} \;

after_ts6133=$(count_error_type "TS6133")
echo "  TS6133 errors: $initial_ts6133 → $after_ts6133"

# Step 4: Add missing override keywords
echo "⚡ Step 3: Adding missing override keywords..."

# Add override to common method patterns
find src -name "*.ts" -not -path "*/node_modules/*" -exec sed -i '' \
  -e 's/^  enhanceQuery(/  override enhanceQuery(/g' \
  -e 's/^  filterResults(/  override filterResults(/g' \
  -e 's/^  detectComplexityLevel(/  override detectComplexityLevel(/g' \
  -e 's/^  customizeRAGContext(/  override customizeRAGContext(/g' \
  -e 's/^  filterKnowledgeForRole(/  override filterKnowledgeForRole(/g' \
  {} \;

# Step 5: Final counts and summary
final_errors=$(count_errors)
final_ts4111=$(count_error_type "TS4111")
final_ts6133=$(count_error_type "TS6133")

fixed_total=$((initial_errors - final_errors))
fixed_ts4111=$((initial_ts4111 - final_ts4111))
fixed_ts6133=$((initial_ts6133 - final_ts6133))

echo ""
echo "📈 MASS FIX RESULTS:"
echo "===================="
echo "Total errors:     $initial_errors → $final_errors (-$fixed_total)"
echo "TS4111 (Index):   $initial_ts4111 → $final_ts4111 (-$fixed_ts4111)"
echo "TS6133 (Unused):  $initial_ts6133 → $final_ts6133 (-$fixed_ts6133)"
echo ""

if [ $fixed_total -gt 0 ]; then
    echo "✅ Successfully fixed $fixed_total compilation errors!"
    percentage=$((fixed_total * 100 / initial_errors))
    echo "📊 Improvement: $percentage% error reduction"
else
    echo "❌ No errors were automatically fixed. Manual intervention required."
fi

echo ""
echo "🎯 NEXT STEPS:"
echo "1. Run 'npm run build' to check remaining errors"
echo "2. Focus on files with highest remaining error counts"
echo "3. Address remaining type mismatches manually"
echo "4. Fix any remaining import/export issues"
echo ""

# Show top remaining error files
echo "🔍 TOP REMAINING ERROR FILES:"
npm run build 2>&1 | grep "error TS" | cut -d'(' -f1 | sort | uniq -c | sort -nr | head -5

echo ""
echo "✨ Mass fix complete!"