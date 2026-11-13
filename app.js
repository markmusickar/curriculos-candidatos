const supabaseUrl = "https://upozyqpdmxhhnynqoefs.supabase.co";
const supabaseKey = "sb_publishable_CyoDQRGvNzohmPjijToDAQ_9zYdIcIy";
// O formulário é público: nunca usa a sessão de quem está logado na área administrativa.
const supabaseClient = window.supabase?.createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
});

class ErroDeValidacao extends Error {}  // mensagem pensada para o candidato ler

const form = document.querySelector("#candidateForm");
const statusEl = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");
const photoInput = document.querySelector("#candidatePhoto");
const photoPreview = document.querySelector("#photoPreview");
let currentPhoto = "";
let uploadedPhoto = null;  // foto já enviada, para não duplicar se o envio do formulário falhar e a pessoa tentar de novo

form.addEventListener("submit", submitCandidate);
document.querySelector("#marketExperience").addEventListener("change", syncStoreExperience);
syncStoreExperience();
document.querySelector("#experienceTime").addEventListener("change", syncExperienceRequired);
syncExperienceRequired();

// Quem tem experiência precisa contar onde trabalhou; quem nunca trabalhou não tem o que contar.
function syncExperienceRequired() {
  const time = value("#experienceTime");
  const hasExperience = time !== "" && time !== "Sem experiência";
  document.querySelector("#lastJob").required = hasExperience;
  document.querySelector("#experience").required = hasExperience;
}

// Só pergunta o tipo de loja e o que fazia quando a pessoa já trabalhou em loja ou mercado.
function syncStoreExperience() {
  const worked = value("#marketExperience") === "Sim";
  const field = document.querySelector("#storeExperience");
  document.querySelector("#storeExperienceField").hidden = !worked;
  field.required = worked;
  if (!worked) field.value = "";
}
photoInput.addEventListener("change", loadCandidatePhoto);

async function submitCandidate(event) {
  event.preventDefault();
  setStatus("Enviando currículo...");
  submitButton.disabled = true;

  try {
    if (!supabaseClient) throw new ErroDeValidacao("O envio não carregou. Verifique a internet e recarregue a página.");

    const payload = collectForm();
    if (!payload.full_name || !payload.phone || !payload.city || !payload.desired_role || !payload.availability) {
      throw new ErroDeValidacao("Preencha os campos obrigatórios.");
    }
    const phoneDigits = payload.phone.replace(/\D/g, "");
    if (phoneDigits.length < 10 || phoneDigits.length > 13) {
      throw new ErroDeValidacao("Confira o WhatsApp: informe o DDD e o número, por exemplo (81) 99999-9999.");
    }
    if (payload.age !== null && (!Number.isInteger(payload.age) || payload.age < 14 || payload.age > 90)) {
      throw new ErroDeValidacao("Confira a idade informada.");
    }
    if (!payload.lgpd_consent) throw new ErroDeValidacao("Marque a caixa de concordância para enviar o currículo.");
    if (!currentPhoto) throw new ErroDeValidacao("Tire ou selecione a foto do candidato.");

    // Se o envio falhar depois da foto, a próxima tentativa reaproveita a mesma foto.
    if (!uploadedPhoto || uploadedPhoto.source !== currentPhoto) {
      uploadedPhoto = { source: currentPhoto, ...(await uploadPhoto(currentPhoto)) };
    }
    payload.photo_path = uploadedPhoto.path;

    const { error } = await supabaseClient.from("job_applications").insert(payload);
    if (error) throw error;

    form.reset();
    syncStoreExperience();
    syncExperienceRequired();
    currentPhoto = "";
    uploadedPhoto = null;
    renderPhotoPreview();
    setStatus("Currículo enviado com sucesso. Obrigado!", false);
  } catch (error) {
    if (!(error instanceof ErroDeValidacao)) console.error(error);
    setStatus(
      error instanceof ErroDeValidacao ? error.message : "Não foi possível enviar agora. Confira a internet e tente de novo.",
      true
    );
  } finally {
    submitButton.disabled = false;
  }
}

async function loadCandidatePhoto() {
  const file = photoInput.files?.[0];
  currentPhoto = "";
  uploadedPhoto = null;
  if (file) {
    try {
      currentPhoto = await resizeImage(file);
    } catch (error) {
      photoInput.value = "";
      setStatus("Não foi possível ler essa foto. Tente tirar outra ou escolher outro arquivo.", true);
    }
  }
  renderPhotoPreview();
}

function renderPhotoPreview() {
  photoPreview.innerHTML = currentPhoto ? `<img src="${currentPhoto}" alt="Foto do candidato">` : "<span>Nenhuma foto selecionada</span>";
}

async function uploadPhoto(dataUrl) {
  const blob = dataUrlToBlob(dataUrl);
  // Nome aleatório: o nome da pessoa não deve aparecer no endereço do arquivo.
  const path = `${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID ? crypto.randomUUID() : randomId()}.jpg`;
  const { error } = await supabaseClient.storage.from("candidato-fotos").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false
  });
  if (error) throw error;
  return { path };
}

function randomId() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return [...bytes].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function resizeImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const image = new Image();
      image.onerror = reject;
      image.onload = () => {
        const max = 900;
        const scale = Math.min(1, max / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);
        canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.72));
      };
      image.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(",");
  const mime = header.match(/:(.*?);/)?.[1] || "image/jpeg";
  const binary = atob(data);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function collectForm() {
  return {
    full_name: value("#fullName"),
    phone: value("#phone"),
    age: numberValue("#age"),
    city: value("#city"),
    neighborhood: value("#neighborhood"),
    desired_role: value("#desiredRole"),
    market_experience: value("#marketExperience"),
    availability: value("#availability"),
    requirements: checkedValues("requirements").join(", "),
    experience: value("#experience"),
    notes: value("#notes"),
    education: value("#education") || null,
    start_availability: value("#startAvailability") || null,
    experience_time: value("#experienceTime") || null,
    store_experience: value("#marketExperience") === "Sim" ? (value("#storeExperience") || null) : null,
    last_job: value("#lastJob") || null,
    skills: value("#skills") || null,
    references_info: value("#referencesInfo") || null,
    how_found: value("#howFound") || null,
    lgpd_consent: document.querySelector("#lgpdConsent").checked,
    source: "formulario_web"
  };
}

function checkedValues(name) {
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map((input) => input.value);
}

function value(selector) {
  return document.querySelector(selector).value.trim();
}

function numberValue(selector) {
  const value = Number(document.querySelector(selector).value);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}
