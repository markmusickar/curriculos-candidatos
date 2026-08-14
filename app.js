const supabaseUrl = "https://upozyqpdmxhhnynqoefs.supabase.co";
const supabaseKey = "sb_publishable_CyoDQRGvNzohmPjijToDAQ_9zYdIcIy";
const supabaseClient = window.supabase?.createClient(supabaseUrl, supabaseKey);

const form = document.querySelector("#candidateForm");
const statusEl = document.querySelector("#formStatus");
const submitButton = document.querySelector("#submitButton");
const photoInput = document.querySelector("#candidatePhoto");
const photoPreview = document.querySelector("#photoPreview");
let currentPhoto = "";

form.addEventListener("submit", submitCandidate);
photoInput.addEventListener("change", loadCandidatePhoto);

async function submitCandidate(event) {
  event.preventDefault();
  setStatus("Enviando currículo...");
  submitButton.disabled = true;

  try {
    if (!supabaseClient) throw new Error("Supabase não carregou. Verifique a internet.");

    const payload = collectForm();
    if (!payload.full_name || !payload.phone || !payload.city || !payload.desired_role || !payload.availability) {
      throw new Error("Preencha os campos obrigatórios.");
    }
    if (!currentPhoto) throw new Error("Tire ou selecione a foto do candidato.");

    const uploaded = await uploadPhoto(currentPhoto, payload.full_name);
    payload.photo_path = uploaded.path;
    payload.photo_url = uploaded.url;

    const { error } = await supabaseClient.from("job_applications").insert(payload);
    if (error) throw error;

    form.reset();
    currentPhoto = "";
    renderPhotoPreview();
    setStatus("Currículo enviado com sucesso. Obrigado!", false);
  } catch (error) {
    setStatus(error.message || "Não foi possível enviar. Tente novamente.", true);
  } finally {
    submitButton.disabled = false;
  }
}

async function loadCandidatePhoto() {
  const file = photoInput.files?.[0];
  currentPhoto = file ? await resizeImage(file) : "";
  renderPhotoPreview();
}

function renderPhotoPreview() {
  photoPreview.innerHTML = currentPhoto ? `<img src="${currentPhoto}" alt="Foto do candidato">` : "<span>Nenhuma foto selecionada</span>";
}

async function uploadPhoto(dataUrl, name) {
  const blob = dataUrlToBlob(dataUrl);
  const path = `${new Date().toISOString().slice(0, 10)}/${Date.now()}-${safeName(name)}.jpg`;
  const { error } = await supabaseClient.storage.from("candidato-fotos").upload(path, blob, {
    contentType: "image/jpeg",
    upsert: false
  });
  if (error) throw error;
  const { data } = supabaseClient.storage.from("candidato-fotos").getPublicUrl(path);
  return { path, url: data.publicUrl };
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

function safeName(value) {
  return String(value || "candidato")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}
