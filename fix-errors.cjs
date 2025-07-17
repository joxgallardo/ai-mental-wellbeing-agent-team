const fs = require('fs');
const path = require('path');

// Función para corregir errores de manejo de errores
function fixErrorHandling(content) {
  // Corregir error.message con tipo 'unknown'
  content = content.replace(
    /error\.message/g,
    'error instanceof Error ? error.message : String(error)'
  );
  
  // Corregir error.stack con tipo 'unknown'
  content = content.replace(
    /error\.stack/g,
    'error instanceof Error ? error.stack : undefined'
  );
  
  return content;
}

// Función para corregir tipos de SearchResult en tests
function fixSearchResultTypes(content) {
  // Corregir documentos sin id y author
  content = content.replace(
    /document: \{ title: '([^']+)', category: '([^']+)' \}/g,
    "document: { id: 'test-id', title: '$1', category: '$2', author: 'Test Author' }"
  );
  
  return content;
}

// Función para corregir imports incorrectos
function fixImports(content) {
  // Corregir AgentCoordinator vs agentCoordinator
  content = content.replace(
    /import \{ AgentCoordinator \} from ['"]\.\.\/\.\.\/services\/agent-coordinator\.service['"];?/g,
    "import { agentCoordinator } from '../../services/agent-coordinator.service';"
  );
  
  content = content.replace(
    /import \{ AgentCoordinator \} from ['"]\.\/agent-coordinator\.service['"];?/g,
    "import { agentCoordinator } from './agent-coordinator.service';"
  );
  
  return content;
}

// Función para corregir propiedades faltantes en agentes
function fixAgentProperties(content) {
  // Corregir domainSpecific por focusArea
  content = content.replace(
    /domainSpecific: true/g,
    'focusArea: "assessment"'
  );
  
  return content;
}

// Función principal para procesar archivos
function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    
    // Aplicar todas las correcciones
    content = fixErrorHandling(content);
    content = fixSearchResultTypes(content);
    content = fixImports(content);
    content = fixAgentProperties(content);
    
    // Solo escribir si hubo cambios
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${filePath}`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${filePath}:`, error);
  }
}

// Lista de archivos a procesar
const filesToProcess = [
  'src/controllers/rollout.controller.ts',
  'src/services/health-check.service.ts',
  'src/services/feature-rollout.service.ts',
  'src/services/rag/knowledge-population.service.ts',
  'src/services/rag/domain-config-loader.service.ts',
  'src/services/rag/life-coaching-adapter.service.ts',
  'src/services/workflow-coordinator.service.ts',
  'src/scripts/rag-migration.ts',
  'src/data/knowledge-base/life-coaching-knowledge.ts',
  'src/__tests__/integration/system-validation.test.ts',
  'src/__tests__/integration/rag-agent-integration.test.ts',
  'src/__tests__/integration/multi-domain-validation.test.ts',
  'src/__tests__/integration/agent-rag-integration.test.ts',
  'src/agents/__tests__/enhanced-base-agent.test.ts',
  'src/services/rag/__tests__/document-processor.service.test.ts',
  'src/services/rag/__tests__/domain-config-loader.service.test.ts',
  'src/services/rag/__tests__/knowledge-population.service.test.ts'
];

// Procesar todos los archivos
console.log('🔧 Starting automatic error fixes...');
filesToProcess.forEach(processFile);
console.log('✅ All files processed!'); 