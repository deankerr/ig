import {
  ApplicationCommandOptionType,
  ApplicationCommandType,
  type RESTPutAPIApplicationGuildCommandsJSONBody,
} from 'discord-api-types/v10'

const imagineAspectChoices = [
  { name: 'Auto', value: 'auto' },
  { name: 'Square', value: 'square' },
  { name: 'Landscape', value: 'landscape' },
  { name: 'Portrait', value: 'portrait' },
] as const

// NOTE: Model is supported but hidden from the public Discord command for launch.
// If the command omits it, the bot falls back to the first configured allowlist entry.

export const imagineCommandDefinition = {
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
    // {
    //   type: ApplicationCommandOptionType.String,
    //   name: 'model',
    //   description: 'Model to use',
    //   required: false,
    //   autocomplete: true,
    // },
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
} satisfies RESTPutAPIApplicationGuildCommandsJSONBody[number]
