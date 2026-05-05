import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  type RESTPutAPIApplicationGuildCommandsJSONBody,
} from 'discord-api-types/v10'

import type { AllowedModel } from '../../models'

const imagineAspectChoices = [
  { name: 'Auto', value: 'auto' },
  { name: 'Square', value: 'square' },
  { name: 'Landscape', value: 'landscape' },
  { name: 'Portrait', value: 'portrait' },
] as const

export function buildImagineCommandDefinition(
  models: AllowedModel[],
): RESTPutAPIApplicationGuildCommandsJSONBody[number] {
  const modelChoices = models
    .slice(0, 25)
    .map((m) => ({ name: m.label.slice(0, 100), value: m.air }))

  return {
    name: 'imagine',
    description: 'Generate an image with ig',
    type: ApplicationCommandType.ChatInput,
    options: [
      {
        type: ApplicationCommandOptionType.String,
        name: 'prompt',
        description: 'What should the image depict?',
        required: true,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'model',
        description: 'Model to use',
        required: false,
        choices: modelChoices.length > 0 ? modelChoices : undefined,
      },
      {
        type: ApplicationCommandOptionType.String,
        name: 'aspect',
        description: 'Aspect preset',
        required: false,
        choices: [...imagineAspectChoices],
      },
      {
        type: ApplicationCommandOptionType.Attachment,
        name: 'reference_image',
        description: 'Optional reference image',
        required: false,
      },
    ],
  }
}
