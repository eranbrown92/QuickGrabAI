import OpenAI from "openai";

// You can set your API key here or use environment variable
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "your-api-key-here"
});

async function main() {
  try {
    console.log("Fetching OpenAI models...\n");
    
    const list = await openai.models.list();
    
    // Filter for vision-capable models (GPT-4, GPT-5 series)
    const visionModels = [];
    const allModels = [];
    
    for await (const model of list) {
      allModels.push(model);
      
      // Check if model supports vision (contains gpt-4 or gpt-5 and likely has vision)
      if (model.id.includes('gpt-4') || model.id.includes('gpt-5')) {
        visionModels.push(model);
      }
    }
    
    console.log("=== VISION-CAPABLE MODELS ===");
    visionModels.forEach(model => {
      console.log(`ID: ${model.id}`);
      console.log(`Created: ${new Date(model.created * 1000).toISOString()}`);
      console.log(`Owner: ${model.owned_by}`);
      console.log("---");
    });
    
    console.log("\n=== ALL MODELS (formatted for dropdown) ===");
    visionModels.forEach(model => {
      // Create display name from model ID
      let displayName = model.id
        .replace(/^gpt-/, 'GPT-')
        .replace(/-\d{4}-\d{2}-\d{2}$/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase());
        
      console.log(`<option value="${model.id}">${displayName}</option>`);
    });
    
    console.log("\n=== JSON FORMAT ===");
    const modelOptions = visionModels.map(model => ({
      id: model.id,
      name: model.id
        .replace(/^gpt-/, 'GPT-')
        .replace(/-\d{4}-\d{2}-\d{2}$/, '')
        .replace(/-/g, ' ')
        .replace(/\b\w/g, l => l.toUpperCase()),
      created: model.created,
      owner: model.owned_by
    }));
    
    console.log(JSON.stringify(modelOptions, null, 2));
    
    console.log(`\nFound ${visionModels.length} vision-capable models out of ${allModels.length} total models.`);
    
  } catch (error) {
    console.error("Error fetching models:", error.message);
    if (error.code === 'invalid_api_key') {
      console.error("Please set a valid API key in the script or OPENAI_API_KEY environment variable");
    }
  }
}

main();