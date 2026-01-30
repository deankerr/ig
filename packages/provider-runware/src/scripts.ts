import { Runware } from "@runware/sdk-js"

const runware = new Runware({ apiKey: process.env.RUNWARE_API_KEY! })

console.log("runware")
const m = await runware.modelSearch({
  taskType: "modelSearch",
  taskUUID: crypto.randomUUID(),
  category: "checkpoint",
  type: "base",
  search: "realistic",
})

console.log(m)
