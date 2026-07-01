# Training and change management plan

Implements issue #18 with deterministic training and communication contracts in `src/govern/operating-model/training-and-communications.mjs`.

## What is implemented

- `buildTrainingAudienceSegments()` defines required rollout audiences (IT admins, builders, service desk, executives), goals, and channels.
- `buildTrainingCurriculum()` defines deterministic learning tracks per audience with module-level delivery mode and completion targets.
- `buildEnablementArtifactPack()` defines minimum templates, internal docs, and communication assets required before rollout.
- `buildRolloutCommunicationsPlan()` defines phased communications for pre-launch, launch, adoption sprint, and steady-state.
- `summarizeTrainingAndCommunicationsReadiness()` provides fail-closed readiness checks for audience coverage, curriculum mapping, artifacts, and rollout-phase completeness.

## Contract boundaries

- **Audience segmentation** answers who must be trained before each rollout stage.
- **Curriculum** answers what each audience must complete to be considered rollout ready.
- **Enablement artifacts** answers which assets operators and communications owners must publish.
- **Rollout communications** answers when and where messages are sent.
- **Readiness summary** answers whether the training/change-management plane is complete versus partially defined.

## Validation

- `tests/govern/training-and-communications.test.mjs`
