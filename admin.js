const supabaseUrl = "https://upozyqpdmxhhnynqoefs.supabase.co";
const supabaseKey = "sb_publishable_CyoDQRGvNzohmPjijToDAQ_9zYdIcIy";
const supabaseClient = window.supabase?.createClient(supabaseUrl, supabaseKey);

const $ = (selector) => document.querySelector(selector);
const loginPanel = $("#loginPanel");
const dashboardPanel = $("#dashboardPanel");
const candidateList = $("#candidateList");
const emptyState = $("#emptyState");
const template = $("#candidateTemplate");

let candidates = [];

$("#adminLogin").addEventListener("click", login);
for (const field of ["#adminEmail", "#adminPassword"]) {
  $(field).addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); login(); } });
}
$("#logoutButton").addEventListener("click", logout);
$("#candidateSearch").addEventListener("input", () => ensureFreshLinks().then(renderCandidates));

boot();

async function boot() {
  if (!supabaseClient) {
    $("#loginStatus").textContent = "Supabase não carregou. Verifique a internet.";
    return;
  }
  const { data } = await supabaseClient.auth.getSession();
  if (data.session) await enterDashboard();
}

let loggingIn = false;
async function login() {
  if (loggingIn) return;
  if (!supabaseClient) {
    $("#loginStatus").textContent = "Supabase não carregou. Verifique a internet.";
    return;
  }
  const email = $("#adminEmail").value.trim();
  const password = $("#adminPassword").value;
  if (!email || !password) {
    $("#loginStatus").textContent = "Informe o e-mail e a senha.";
    return;
  }
  loggingIn = true;
  $("#loginStatus").textContent = "Entrando...";
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      $("#loginStatus").textContent = "E-mail ou senha inválidos.";
      return;
    }
    $("#adminPassword").value = "";
    await enterDashboard();
  } catch (error) {
    $("#loginStatus").textContent = "Não foi possível entrar agora. Verifique a internet e tente de novo.";
  } finally {
    loggingIn = false;
  }
}

async function logout() {
  await supabaseClient.auth.signOut();
  candidates = [];
  dashboardPanel.hidden = true;
  loginPanel.hidden = false;
}

async function enterDashboard() {
  loginPanel.hidden = true;
  dashboardPanel.hidden = false;
  await loadCandidates();
}

async function loadCandidates() {
  $("#adminSummary").textContent = "Carregando candidatos...";
  const { data, error } = await supabaseClient
    .from("job_applications")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    $("#adminSummary").textContent = `Não foi possível carregar: ${error.message}`;
    candidates = [];
    renderCandidates();
    return;
  }

  candidates = data || [];
  await signPhotoUrls();
  $("#adminSummary").textContent = `${candidates.length} candidato${candidates.length === 1 ? "" : "s"} cadastrado${candidates.length === 1 ? "" : "s"}.`;
  renderCandidates();
}

// As fotos ficam num armazenamento privado: o administrador vê cada uma por um link temporário (1 hora).
const PHOTO_BUCKET = "candidato-fotos";
const photoLinks = new Map();
let signedAt = 0;

// Os links duram 1 hora; se a página ficou aberta por muito tempo, pede links novos antes de mostrar a lista.
async function ensureFreshLinks() {
  if (candidates.length && Date.now() - signedAt > 50 * 60 * 1000) await signPhotoUrls();
}

async function signPhotoUrls() {
  photoLinks.clear();
  signedAt = Date.now();
  const paths = [...new Set(candidates.map((candidate) => candidate.photo_path).filter(Boolean))];
  if (!paths.length) return;
  try {
    const { data, error } = await supabaseClient.storage.from(PHOTO_BUCKET).createSignedUrls(paths, 3600);
    if (error) throw error;
    for (const item of data || []) if (item.signedUrl && !item.error) photoLinks.set(item.path, item.signedUrl);
  } catch (error) {
    console.error(error);  // sem os links, a lista aparece com "Sem foto"
  }
}

function renderCandidates() {
  const query = $("#candidateSearch").value.trim().toLocaleLowerCase("pt-BR");
  const filtered = candidates.filter((candidate) => [
    candidate.full_name,
    candidate.phone,
    candidate.city,
    candidate.neighborhood,
    candidate.desired_role,
    candidate.availability,
    candidate.requirements,
    candidate.status
  ].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(query)));

  candidateList.innerHTML = "";
  emptyState.hidden = filtered.length > 0;

  filtered.forEach((candidate) => {
    const node = template.content.firstElementChild.cloneNode(true);
    node.querySelector("h2").textContent = candidate.full_name;
    node.querySelector(".status-pill").textContent = candidate.status || "novo";
    node.querySelector(".candidate-role").textContent = candidate.desired_role || "Cargo não informado";

    const photo = node.querySelector(".candidate-photo");
    const photoSrc = photoLinks.get(candidate.photo_path);
    if (photoSrc) {
      const image = new Image();
      image.loading = "lazy";
      image.src = photoSrc;
      image.alt = `Foto de ${candidate.full_name}`;
      photo.append(image);
    } else {
      photo.innerHTML = "<span>Sem foto</span>";
    }

    node.querySelector(".candidate-details").innerHTML = detailsHtml(candidate);
    node.querySelector(".candidate-requirements").textContent = candidate.requirements ? `Requisitos: ${candidate.requirements}` : "Requisitos não informados.";
    node.querySelector(".candidate-experience").textContent = candidate.experience ? `Experiência: ${candidate.experience}` : "Experiência não informada.";
    node.querySelector(".candidate-notes").textContent = candidate.notes ? `Observações: ${candidate.notes}` : "";
    candidateList.append(node);
  });
}

function detailsHtml(candidate) {
  const details = [
    ["WhatsApp", candidate.phone],
    ["Idade", candidate.age ? `${candidate.age} anos` : "Não informada"],
    ["Cidade", [candidate.city, candidate.neighborhood].filter(Boolean).join(" - ")],
    ["Mercado", candidate.market_experience],
    ["Disponibilidade", candidate.availability],
    ["Enviado em", formatDate(candidate.created_at)]
  ];
  return details.map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value || "-")}</dd></div>`).join("");
}

function formatDate(value) {
  return new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char]));
}
