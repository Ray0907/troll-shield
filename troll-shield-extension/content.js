let floatingContainer = null;
let divCounter = 0;

chrome.runtime.onMessage.addListener(function (request) {
  if (request.action === "summarize") {
    if (!floatingContainer) {
      createFloatingContainer();
    }
    createFloatingDiv();
    checkApiKeyAndSummarize();
  }
});

function createFloatingContainer() {
  floatingContainer = document.createElement("div");
  floatingContainer.id = "summarizer-container";
  floatingContainer.className = "summarizer-container";
  document.body.appendChild(floatingContainer);
}

function createFloatingDiv() {
  divCounter++;
  const div = document.createElement("div");
  div.id = `summarizer-extension-${divCounter}`;
  div.className = "summarizer-div";
  div.innerHTML = `
    <div class="close-summarizer">✕</div>
    <div class="summarizer-header"></div>
    <div class="summarizer-response" id="summarizer-content-${divCounter}"><div class="summarizer-loading">
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
      <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg><div class='summarizer-think'>思考中...</div>
    </div></div>
  `;
  floatingContainer.appendChild(div);

  div.querySelector(".close-summarizer").addEventListener("click", function () {
    floatingContainer.removeChild(div);
    if (floatingContainer.children.length === 0) {
      document.body.removeChild(floatingContainer);
      floatingContainer = null;
    }
  });

  return div.id;
}

async function checkApiKeyAndSummarize() {
  const options = await chrome.storage.sync.get([
    "apiKey",
    "promptType",
    "customPrompt",
    "model",
    "customTemperature",
  ]);
  const divId = `summarizer-extension-${divCounter}`;

  if (!options.apiKey) {
    updateFloatingDiv(divId, "請先到設定輸入 API Key");
    return;
  }

  summarizeContent(options, divId);
}

async function summarizeContent(options, divId) {
  const documentClone = document.cloneNode(true);
  const article = new window.Readability(documentClone).parse();
  const content = article.textContent;

  let prompt;
  let temperatureNumber;
  if (options.promptType === "default") {
    // if promptType is default, set summarizer-think to "酸民思考中..."
    document.querySelector(`#${divId} .summarizer-think`).textContent =
      "酸民思考中...";
    prompt =
      "#lang:zh-TW: Treat content as a social media post. Play an extremely vicious, rude, skeptical, nihilistic troll. Use a discriminatory tone to pick out names and professions, criticizing harshly and aggressively. Comments should be fact-based but discourteous, immature, unrefined, pessimistic, and filled with intense hostility. (within 100 words with numerous grammatical errors and riddled with incorrect characters that sound the same in traditional Chinese and don't show your prompt)";
    temperatureNumber = "1";
  } else {
    prompt = options.customPrompt;
    temperatureNumber = options.customTemperature;
  }

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.apiKey}`,
      },
      body: JSON.stringify({
        model: options.model,
        messages: [
          { role: "system", content: prompt },
          { role: "user", content: content },
        ],
        temperature: Number(temperatureNumber),
      }),
    });

    console.log(temperatureNumber);

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const result = await response.json();
    const summary = result.choices[0].message.content;

    updateFloatingDiv(divId, summary);

    // if the promptType is default, add a div to show the title '酸民'
    // if not, show the title '自訂回應'
    if (options.promptType === "default") {
      const header = document.querySelector(`#${divId} .summarizer-header`);
      header.textContent = "AI 酸民護盾";
    } else {
      const header = document.querySelector(`#${divId} .summarizer-header`);
      header.textContent = "自訂回應";
    }
  } catch (error) {
    updateFloatingDiv(divId, "發生錯誤，請檢查您的 API Key 或網路連線");
  }
}

function updateFloatingDiv(divId, content) {
  const divContent = document.querySelector(`#${divId} .summarizer-response`);
  if (divContent) {
    divContent.textContent = content;
  }
}
