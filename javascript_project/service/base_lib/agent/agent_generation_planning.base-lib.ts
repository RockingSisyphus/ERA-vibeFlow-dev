import {defineBaseLib} from "@vibeflow/plugin";

export const era_service_agent_generation_planning = defineBaseLib({
  "id": "era.service.agent_generation_planning",
  "display_name": "agent-generation-planning",
  "description": "Service Agent stage execution with injected capability and no module state.",
  "version": "1.0.0",
  "implementations": [
    {
      "language": "typescript",
      "targets": [
        "browser",
        "node"
      ],
      "source": {
        "kind": "file",
        "ref": "base_lib/agent/agent_generation_planning.ts"
      }
    }
  ],
  "dependencies": [
    "era.service.agent_stage_layout",
    "era.service.agent_stage_text",
    "era.service.agent_generation_session",
    "era.service.agent_configuration",
    "era.service.agent_report_text",
    "era.service.agent_generation_context",
    "era.service.agent_flow_types"
  ],
  "external_packages": [],
  "rulesets": [
    "vibeflow.base_lib"
  ]
});
