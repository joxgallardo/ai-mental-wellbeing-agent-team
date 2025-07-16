#!/usr/bin/env ts-node

/**
 * Zero-Disruption RAG Migration Script
 * 
 * Safely migrates agents from BaseAgent to EnhancedBaseAgent with rollback capability.
 */

import { createLogger } from '../utils/logger';
import { agentCoordinator } from '../services/agent-coordinator.service';
import { ragFoundationService } from '../services/rag/rag-foundation.service';
import { featureFlagService } from '../services/feature-flag.service';
import { healthCheckService } from '../services/health-check.service';

const logger = createLogger('RAGMigration');

interface MigrationStatus {
  step: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  timestamp: string;
  details?: any;
  rollbackRequired?: boolean;
}

class RAGMigrationService {
  private migrationLog: MigrationStatus[] = [];
  private rollbackSteps: (() => Promise<void>)[] = [];

  async executeMigration(): Promise<void> {
    logger.info('🚀 Starting zero-disruption RAG migration');
    
    try {
      // Step 1: Pre-migration validation
      await this.step('pre_validation', async () => {
        await this.validatePreconditions();
      });

      // Step 2: Enable feature flag gradual rollout
      await this.step('feature_flag_setup', async () => {
        await this.setupFeatureFlags();
      });

      // Step 3: Validate RAG infrastructure
      await this.step('rag_validation', async () => {
        await this.validateRAGInfrastructure();
      });

      // Step 4: Test enhanced agents in isolation
      await this.step('agent_testing', async () => {
        await this.testEnhancedAgents();
      });

      // Step 5: Enable RAG enhancement gradually
      await this.step('gradual_activation', async () => {
        await this.enableGradualActivation();
      });

      // Step 6: Monitor system health
      await this.step('health_monitoring', async () => {
        await this.monitorSystemHealth();
      });

      // Step 7: Validate full system integration
      await this.step('integration_validation', async () => {
        await this.validateFullIntegration();
      });

      logger.info('✅ RAG migration completed successfully');
      this.logMigrationSummary();

    } catch (error) {
      logger.error('❌ RAG migration failed', { error: error.message });
      await this.executeRollback();
      throw error;
    }
  }

  private async step(stepName: string, operation: () => Promise<void>): Promise<void> {
    const migrationStatus: MigrationStatus = {
      step: stepName,
      status: 'in_progress',
      timestamp: new Date().toISOString(),
    };
    
    this.migrationLog.push(migrationStatus);
    logger.info(`📋 Starting step: ${stepName}`);

    try {
      await operation();
      migrationStatus.status = 'completed';
      logger.info(`✅ Completed step: ${stepName}`);
    } catch (error) {
      migrationStatus.status = 'failed';
      migrationStatus.details = error.message;
      migrationStatus.rollbackRequired = true;
      logger.error(`❌ Failed step: ${stepName}`, { error: error.message });
      throw error;
    }
  }

  private async validatePreconditions(): Promise<void> {
    logger.info('🔍 Validating migration preconditions');

    // Check system health
    const healthCheck = await healthCheckService.getReadinessHealth();
    if (healthCheck.status !== 'healthy') {
      throw new Error(`System not healthy: ${healthCheck.status}`);
    }

    // Validate knowledge base exists
    if (!ragFoundationService.isEnabled()) {
      throw new Error('RAG foundation service not enabled');
    }

    // Check database connectivity
    const ragReady = ragFoundationService.isReady();
    if (!ragReady) {
      throw new Error('RAG system not ready - check database connectivity');
    }

    // Validate enhanced agents are properly implemented
    const agentStatus = agentCoordinator.getAgentStatus();
    const expectedAgents = ['assessment', 'action', 'followUp'];
    
    for (const agent of expectedAgents) {
      if (!agentStatus[agent] || agentStatus[agent].type !== 'EnhancedBaseAgent') {
        throw new Error(`Agent ${agent} not properly migrated to EnhancedBaseAgent`);
      }
    }

    logger.info('✅ All preconditions validated');
  }

  private async setupFeatureFlags(): Promise<void> {
    logger.info('🎛️ Setting up feature flags for gradual rollout');

    // Set initial RAG enhancement to 0% (disabled)
    await featureFlagService.setPercentage('rag_enhancement', 0);
    
    // Add rollback step
    this.rollbackSteps.push(async () => {
      await featureFlagService.setPercentage('rag_enhancement', 0);
      logger.info('🔄 Rolled back feature flag to 0%');
    });

    // Verify feature flag is properly set
    const isEnabled = await featureFlagService.isEnabled('rag_enhancement', { userId: 'test' });
    if (isEnabled) {
      throw new Error('Feature flag should be disabled initially');
    }

    logger.info('✅ Feature flags configured for migration');
  }

  private async validateRAGInfrastructure(): Promise<void> {
    logger.info('🏗️ Validating RAG infrastructure');

    // Test knowledge base search
    try {
      const searchResults = await ragFoundationService.hybridSearch(
        'stress management techniques',
        { limit: 3, threshold: 0.7 }
      );
      
      if (!searchResults || searchResults.length === 0) {
        throw new Error('Knowledge base search returned no results');
      }
      
      logger.info(`✅ Knowledge base search working - ${searchResults.length} results found`);
    } catch (error) {
      throw new Error(`Knowledge base search failed: ${error.message}`);
    }

    // Test domain adapter system
    try {
      const { DomainAdapterFactory } = await import('../services/rag/domain-adapter.service');
      const adapter = DomainAdapterFactory.getAdapter('life_coaching');
      
      if (!adapter) {
        throw new Error('Domain adapter not available');
      }
      
      logger.info('✅ Domain adapter system working');
    } catch (error) {
      throw new Error(`Domain adapter validation failed: ${error.message}`);
    }

    logger.info('✅ RAG infrastructure validated');
  }

  private async testEnhancedAgents(): Promise<void> {
    logger.info('🧪 Testing enhanced agents in isolation');

    const testInput = {
      mentalState: 'I have been feeling overwhelmed with work stress and having trouble sleeping',
      sleepPattern: 5,
      stressLevel: 7,
      supportSystem: ['family'],
      recentChanges: 'Started new job 2 weeks ago',
      currentSymptoms: ['anxiety', 'insomnia']
    };

    const testSessionId = `migration-test-${Date.now()}`;

    try {
      // Test with RAG temporarily enabled for this session
      await featureFlagService.setPercentage('rag_enhancement', 100);
      
      const plan = await agentCoordinator.generateMentalHealthPlan(testInput, testSessionId);
      
      // Validate that plan was generated successfully
      if (!plan.assessment || !plan.actionPlan || !plan.followUp) {
        throw new Error('Incomplete mental health plan generated');
      }

      // Check for RAG metadata in responses
      const hasRAGMetadata = 
        plan.assessment.ragMetadata ||
        plan.actionPlan.ragMetadata ||
        plan.followUp.ragMetadata;

      if (!hasRAGMetadata) {
        logger.warn('⚠️ No RAG metadata found - agents may not be using RAG enhancement');
      }

      logger.info('✅ Enhanced agents test successful', {
        assessmentLength: plan.assessment.content.length,
        actionActionsCount: plan.actionPlan.immediateActions.length,
        followUpStrategiesCount: plan.followUp.longTermStrategies.length,
        hasRAGMetadata: !!hasRAGMetadata
      });

    } finally {
      // Reset feature flag to 0%
      await featureFlagService.setPercentage('rag_enhancement', 0);
    }
  }

  private async enableGradualActivation(): Promise<void> {
    logger.info('📈 Starting gradual RAG activation');

    const rolloutSteps = [5, 10, 25, 50, 100];
    
    for (const percentage of rolloutSteps) {
      logger.info(`🎯 Activating RAG for ${percentage}% of users`);
      
      await featureFlagService.setPercentage('rag_enhancement', percentage);
      
      // Wait for activation to take effect
      await this.sleep(30000); // 30 seconds
      
      // Monitor system health during activation
      const healthCheck = await healthCheckService.getReadinessHealth();
      if (healthCheck.status !== 'healthy') {
        throw new Error(`System health degraded at ${percentage}% activation: ${healthCheck.status}`);
      }
      
      // Test a sample request
      await this.validateSampleRequest();
      
      logger.info(`✅ ${percentage}% activation successful`);
    }

    // Add rollback step for final state
    this.rollbackSteps.push(async () => {
      await featureFlagService.setPercentage('rag_enhancement', 0);
      logger.info('🔄 Rolled back RAG activation to 0%');
    });

    logger.info('✅ Gradual activation completed');
  }

  private async monitorSystemHealth(): Promise<void> {
    logger.info('🔍 Monitoring system health post-migration');

    const monitoringDuration = 60000; // 1 minute
    const checkInterval = 10000; // 10 seconds
    const startTime = Date.now();

    while (Date.now() - startTime < monitoringDuration) {
      const healthCheck = await healthCheckService.getReadinessHealth();
      
      if (healthCheck.status !== 'healthy') {
        throw new Error(`System health check failed: ${healthCheck.status}`);
      }

      // Check specific RAG health
      const ragHealth = healthCheck.checks.rag;
      if (ragHealth && ragHealth.status !== 'healthy') {
        throw new Error(`RAG system health check failed: ${ragHealth.status}`);
      }

      logger.info('📊 System health check passed', {
        status: healthCheck.status,
        ragStatus: ragHealth?.status || 'unknown'
      });

      await this.sleep(checkInterval);
    }

    logger.info('✅ System health monitoring completed');
  }

  private async validateFullIntegration(): Promise<void> {
    logger.info('🔬 Validating full system integration');

    // Test complete workflow with various scenarios
    const testScenarios = [
      {
        name: 'High stress scenario',
        input: {
          mentalState: 'I am extremely overwhelmed and having panic attacks',
          sleepPattern: 3,
          stressLevel: 9,
          supportSystem: [],
          recentChanges: 'Lost my job',
          currentSymptoms: ['anxiety', 'depression', 'panic attacks']
        }
      },
      {
        name: 'Moderate stress scenario',
        input: {
          mentalState: 'Feeling stressed about work deadlines but managing',
          sleepPattern: 6,
          stressLevel: 6,
          supportSystem: ['friends', 'family'],
          recentChanges: 'Heavy workload this month',
          currentSymptoms: ['stress', 'fatigue']
        }
      },
      {
        name: 'Low stress scenario',
        input: {
          mentalState: 'Generally doing well, just want to maintain good mental health',
          sleepPattern: 7,
          stressLevel: 3,
          supportSystem: ['family', 'friends', 'therapist'],
          recentChanges: 'Started meditation practice',
          currentSymptoms: []
        }
      }
    ];

    for (const scenario of testScenarios) {
      logger.info(`🧪 Testing scenario: ${scenario.name}`);
      
      const sessionId = `integration-test-${Date.now()}-${scenario.name.replace(/\s+/g, '-')}`;
      const plan = await agentCoordinator.generateMentalHealthPlan(scenario.input, sessionId);
      
      // Validate plan structure and quality
      if (!plan.assessment || !plan.actionPlan || !plan.followUp) {
        throw new Error(`Incomplete plan for scenario: ${scenario.name}`);
      }

      // Validate that responses are contextually appropriate
      const assessmentRisk = plan.assessment.riskLevel;
      const actionUrgency = plan.actionPlan.urgency;
      
      if (scenario.name.includes('High stress') && (assessmentRisk !== 'high' && actionUrgency !== 'high')) {
        logger.warn(`⚠️ High stress scenario may not have appropriate urgency levels`);
      }

      logger.info(`✅ Scenario validated: ${scenario.name}`, {
        riskLevel: assessmentRisk,
        urgency: actionUrgency,
        strategiesCount: plan.followUp.longTermStrategies.length
      });
    }

    logger.info('✅ Full integration validation completed');
  }

  private async validateSampleRequest(): Promise<void> {
    const testInput = {
      mentalState: 'Testing RAG integration with sample request',
      sleepPattern: 7,
      stressLevel: 5,
      supportSystem: ['family'],
      recentChanges: 'Testing migration',
      currentSymptoms: ['stress']
    };

    const sessionId = `validation-${Date.now()}`;
    const plan = await agentCoordinator.generateMentalHealthPlan(testInput, sessionId);
    
    if (!plan.assessment || !plan.actionPlan || !plan.followUp) {
      throw new Error('Sample request validation failed - incomplete plan');
    }
  }

  private async executeRollback(): Promise<void> {
    logger.info('🔄 Executing migration rollback');

    for (const rollbackStep of this.rollbackSteps.reverse()) {
      try {
        await rollbackStep();
      } catch (error) {
        logger.error('❌ Rollback step failed', { error: error.message });
      }
    }

    logger.info('✅ Rollback completed');
  }

  private logMigrationSummary(): void {
    logger.info('📊 Migration Summary', {
      totalSteps: this.migrationLog.length,
      completedSteps: this.migrationLog.filter(s => s.status === 'completed').length,
      failedSteps: this.migrationLog.filter(s => s.status === 'failed').length,
      migrationLog: this.migrationLog
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main(): Promise<void> {
  const migration = new RAGMigrationService();
  
  try {
    await migration.executeMigration();
    process.exit(0);
  } catch (error) {
    logger.error('Migration failed', { error: error.message });
    process.exit(1);
  }
}

// Execute if called directly
if (require.main === module) {
  main();
}

export { RAGMigrationService };