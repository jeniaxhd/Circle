const $ = (selector) => document.querySelector(selector);
const key = "circle-test-ui-sessions";
let saved;
try {
  saved = JSON.parse(sessionStorage.getItem(key) || "{}");
} catch {
  saved = {};
}
const S = {
  accounts: Array.isArray(saved.accounts)
    ? saved.accounts.filter((a) => a?.user?.id && typeof a.token === "string")
    : [],
  activeId: String(saved.activeId || ""),
  circleId: "",
  postId: "",
  section: "posts",
  circles: [],
  items: [],
  operation: 0,
  epoch: 0,
  history: [],
};
const account = () => S.accounts.find((a) => String(a.user.id) === S.activeId);
const persist = () =>
  sessionStorage.setItem(
    key,
    JSON.stringify({ accounts: S.accounts, activeId: S.activeId }),
  );
const circle = () => "/circles/" + S.circleId;
const text = (name, label, required = true, max = 200) => ({
  name,
  label,
  required,
  max,
});
const long = (name, label, max = 5000, required = false) => ({
  name,
  label,
  type: "textarea",
  max,
  required,
  clear: !required,
});
const date = (name, label, required = true) => ({
  name,
  label,
  type: "datetime-local",
  required,
});
const choice = (name, label, choices) => ({
  name,
  label,
  type: "select",
  choices,
  required: true,
});
const op = (
  label,
  method,
  suffix = "",
  fields = [],
  item = false,
  edit = false,
) => ({ label, method, suffix, fields, item, edit });
const list = () => op("Получить список", "GET");
const details = () => op("Получить выбранную запись", "GET", "/:id", [], true);
const remove = () => ({
  ...op("Удалить выбранную запись", "DELETE", "/:id", [], true),
  confirm: true,
});
const eventFields = [
  text("title", "Название события"),
  long("description", "Описание события"),
  date("eventDate", "Дата события"),
];
const memoryFields = [
  text("title", "Название воспоминания"),
  long("text", "История", 10000),
  {
    ...text("imageUrl", "Ссылка на фото", false, 2048),
    type: "url",
    clear: true,
  },
  date("occurredAt", "Дата воспоминания"),
];
const resources = {
  posts: {
    label: "Посты",
    route: "/posts",
    operations: [
      list(),
      details(),
      op("Создать пост", "POST", "", [long("text", "Текст поста", 5000, true)]),
      op(
        "Изменить пост",
        "PATCH",
        "/:id",
        [long("text", "Текст поста", 5000, true)],
        true,
        true,
      ),
      remove(),
    ],
  },
  comments: {
    label: "Комментарии",
    route: () => "/posts/" + S.postId + "/comments",
    operations: [
      list(),
      op("Создать комментарий", "POST", "", [
        long("text", "Текст комментария", 2000, true),
      ]),
      op(
        "Изменить комментарий",
        "PATCH",
        "/:id",
        [long("text", "Текст комментария", 2000, true)],
        true,
        true,
      ),
      remove(),
    ],
  },
  polls: {
    label: "Опросы",
    route: "/polls",
    operations: [
      list(),
      details(),
      op("Создать опрос", "POST", "", [
        text("title", "Вопрос"),
        {
          name: "options",
          label: "Варианты — каждый с новой строки (2–10)",
          type: "lines",
          required: true,
        },
        date("closesAt", "Закрыть автоматически (необязательно)", false),
      ]),
      op(
        "Переименовать опрос",
        "PATCH",
        "/:id",
        [text("title", "Вопрос")],
        true,
        true,
      ),
      op(
        "Проголосовать",
        "POST",
        "/:id/votes",
        [
          choice(
            "optionId",
            "Вариант ответа",
            () =>
              selected()?.pollOptions?.map((o) => [
                o.id,
                o.title + " — " + o._count.votes + " голосов",
              ]) || [],
          ),
        ],
        true,
      ),
      {
        ...op("Закрыть опрос", "PATCH", "/:id/close", [], true),
        confirm: true,
      },
      remove(),
    ],
  },
  events: {
    label: "События",
    route: "/events",
    operations: [
      list(),
      details(),
      op("Создать событие", "POST", "", eventFields),
      op("Изменить событие", "PATCH", "/:id", eventFields, true, true),
      remove(),
      op(
        "Ответить на событие (RSVP)",
        "PUT",
        "/:id/rsvp",
        [
          choice("status", "Мой ответ", [
            ["GOING", "Пойду"],
            ["MAYBE", "Возможно"],
            ["NOT_GOING", "Не пойду"],
          ]),
        ],
        true,
      ),
      op("Отменить RSVP", "DELETE", "/:id/rsvp", [], true),
      op("Посмотреть ответы участников", "GET", "/:id/attendees", [], true),
    ],
  },
  memories: {
    label: "Воспоминания",
    route: "/memories",
    operations: [
      list(),
      details(),
      op("Создать воспоминание", "POST", "", memoryFields),
      op("Изменить воспоминание", "PATCH", "/:id", memoryFields, true, true),
      remove(),
    ],
  },
  invites: {
    label: "Приглашения",
    route: "/invites",
    operations: [
      list(),
      op("Создать приглашение", "POST", "", [
        {
          name: "maxUses",
          label: "Количество вступлений",
          type: "number",
          min: 1,
          max: 100,
          default: 1,
          required: true,
        },
        {
          name: "expiresInHours",
          label: "Срок в часах",
          type: "number",
          min: 1,
          max: 168,
          default: 24,
          required: true,
        },
      ]),
      {
        ...op("Отключить приглашение", "PATCH", "/:id/revoke", [], true),
        confirm: true,
      },
    ],
  },
  members: {
    label: "Участники",
    route: "/members",
    operations: [
      list(),
      details(),
      op(
        "Изменить роль",
        "PATCH",
        "/:id",
        [
          choice("role", "Новая роль", [
            ["MEMBER", "MEMBER"],
            ["ADMIN", "ADMIN"],
          ]),
        ],
        true,
        true,
      ),
      { ...remove(), label: "Исключить участника" },
      {
        ...op("Выйти из круга", "DELETE"),
        path: () => circle() + "/membership",
        confirm: true,
      },
    ],
  },
  search: {
    label: "Поиск",
    route: "/search",
    noList: true,
    operations: [
      op("Найти посты", "GET", "", [text("q", "Текст для поиска", true, 200)]),
    ],
  },
  settings: {
    label: "Настройки круга",
    route: "",
    operations: [
      op("Получить круг", "GET"),
      op(
        "Изменить круг",
        "PATCH",
        "",
        [text("name", "Название круга"), long("description", "Описание круга")],
        false,
        true,
      ),
      { ...op("Удалить круг со всеми данными", "DELETE"), confirm: true },
    ],
  },
};

function el(tag, attrs = {}, ...children) {
  const element = document.createElement(tag);
  for (const [name, value] of Object.entries(attrs)) {
    if (name.startsWith("on"))
      element.addEventListener(name.slice(2).toLowerCase(), value);
    else if (value !== undefined && value !== false)
      element.setAttribute(name, value === true ? "" : String(value));
  }
  for (const child of children.flat())
    if (child !== null && child !== undefined)
      element.append(
        child instanceof Node ? child : document.createTextNode(String(child)),
      );
  return element;
}
function notice(message, error = false) {
  $("#notice").textContent = message;
  $("#notice").className = error ? "error" : "";
}
function clearContext() {
  $("#posts").replaceChildren();
  S.epoch++;
  S.items = [];
  S.postId = "";
  S.history = [];
  $("#new-invite").hidden = true;
  $("#invite-link").value = "";
  $("#items").replaceChildren();
  $("#history").replaceChildren();
  $("#response").textContent = "Запросов пока нет.";
}
function redact(value) {
  if (Array.isArray(value)) return value.map(redact);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value).map(([name, data]) => [
      name,
      /token|password|authorization/i.test(name) ? "[скрыто]" : redact(data),
    ]),
  );
}
function showResponse(entry) {
  $("#response").textContent =
    entry.status +
    " " +
    entry.method +
    " " +
    entry.path +
    "\n\n" +
    JSON.stringify(entry.data, null, 2);
}
function record(method, path, status, data) {
  const entry = {
    method,
    path: path.replace(/\/invites\/[^/]+\/accept/, "/invites/[token]/accept"),
    status,
    data: redact(data),
  };
  S.history.unshift(entry);
  S.history.length = Math.min(S.history.length, 10);
  $("#history").replaceChildren(
    ...S.history.map((item) =>
      el(
        "button",
        { type: "button", onclick: () => showResponse(item) },
        item.status + " " + item.method + " " + item.path,
      ),
    ),
  );
  showResponse(entry);
}
async function api(method, path, body, token = account()?.token) {
  const epoch = S.epoch;
  const headers = {};
  if (token) headers.Authorization = "Bearer " + token;
  if (body !== undefined) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch("/api" + path, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    const error = new Error("Нет соединения с локальным сервером интерфейса.");
    if (epoch !== S.epoch) error.stale = true;
    throw error;
  }
  const raw = await response.text();
  let data;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = raw;
  }
  if (epoch !== S.epoch) {
    const error = new Error("Контекст изменился");
    error.stale = true;
    throw error;
  }
  record(method, path, response.status, data);
  if (!response.ok)
    throw new Error(
      response.status +
        ": " +
        (Array.isArray(data?.message)
          ? data.message.join("\n")
          : data?.message || raw || response.statusText),
    );
  return data;
}
async function run(action, button) {
  if (button) button.disabled = true;
  notice("Выполняю запрос…");
  try {
    await action();
    if ($("#notice").textContent === "Выполняю запрос…") notice("Готово.");
  } catch (error) {
    if (!error.stale) notice(error.message, true);
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}
function renderShell() {
  $("#accounts").replaceChildren(
    el("option", { value: "" }, "Не выбран"),
    ...S.accounts.map((a) =>
      el(
        "option",
        { value: a.user.id },
        a.user.name + " · " + a.user.email + " (#" + a.user.id + ")",
      ),
    ),
  );
  $("#accounts").value = S.activeId;
  $("#workspace").hidden = !account();
  $("#auth").open = !account();
  $("#logout").disabled = !account();
  $("#tabs").replaceChildren(
    ...Object.entries(resources).map(([name, config]) =>
      el(
        "button",
        {
          type: "button",
          "aria-current": S.section === name ? "page" : "false",
          onclick: () =>
            run(async () => {
              S.epoch++;
              S.section = name;
              S.operation = 0;
              S.items = [];
              renderShell();
              await loadList();
            }),
        },
        config.label,
      ),
    ),
  );
}
function basePath() {
  const route = resources[S.section].route;
  return circle() + (typeof route === "function" ? route() : route);
}
function selected() {
  return (
    S.items.find((item) => String(item.__key) === $("#items").value) ||
    S.items[0]
  );
}
function localDate(value) {
  if (!value) return "";
  const date = new Date(value);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 23);
}
function renderForm() {
  const config = resources[S.section];
  const operation = config.operations[S.operation];
  const form = $("#operation-form");
  form.replaceChildren();
  if (!S.circleId) {
    form.append(el("p", {}, "Создай круг или вступи по приглашению."));
    return;
  }
  const source = selected() || {};
  for (const field of operation.fields) {
    let control;
    if (field.type === "select") {
      const options =
        typeof field.choices === "function" ? field.choices() : field.choices;
      control = el(
        "select",
        { name: field.name, required: field.required },
        ...options.map(([value, label]) => el("option", { value }, label)),
      );
    } else {
      control = el(
        ["textarea", "lines"].includes(field.type) ? "textarea" : "input",
        {
          name: field.name,
          type: ["textarea", "lines"].includes(field.type)
            ? undefined
            : field.type || "text",
          required: field.required,
          maxlength: field.type === "number" ? undefined : field.max,
          min: field.min,
          max: field.type === "number" ? field.max : undefined,
          step:
            field.type === "number"
              ? 1
              : field.type === "datetime-local"
                ? "any"
                : undefined,
        },
      );
    }
    const value = operation.edit ? source[field.name] : field.default;
    if (value !== undefined && value !== null)
      control.value =
        field.type === "datetime-local" ? localDate(value) : value;
    form.append(el("label", {}, el("span", {}, field.label), control));
  }
  form.append(el("button", { type: "submit" }, operation.label));
}
function renderItems() {
  const current = $("#items").value;
  $("#items").replaceChildren(
    el(
      "option",
      { value: "" },
      S.items.length ? "Выбери запись" : "Список пуст",
    ),
    ...S.items.map((item) => {
      const name =
        item.title ||
        item.name ||
        item.user?.name ||
        item.text?.slice(0, 65) ||
        "Приглашение";
      return el(
        "option",
        { value: item.__key },
        "#" + item.__key + " · " + name + (item.role ? " · " + item.role : ""),
      );
    }),
  );
  $("#items").value = S.items.some((item) => String(item.__key) === current)
    ? current
    : String(S.items[0]?.__key || "");
}
function renderOperations() {
  const config = resources[S.section];
  $("#section-title").textContent = config.label;
  $("#post-label").hidden = S.section !== "comments";
  $("#item-label").hidden = ["search", "settings"].includes(S.section);
  $("#operations").replaceChildren(
    ...config.operations.map((operation, index) =>
      el("option", { value: index }, operation.label),
    ),
  );
  $("#operations").value = S.operation;
  renderItems();
  renderForm();
}
async function loadList() {
  S.items = [];
  renderOperations();
  if (!S.circleId) return;
  if (S.section === "comments") {
    const posts = await api("GET", circle() + "/posts");
    if (!posts.some((post) => String(post.id) === S.postId))
      S.postId = String(posts[0]?.id || "");
    $("#posts").replaceChildren(
      el("option", { value: "" }, "Выбери пост"),
      ...posts.map((post) =>
        el(
          "option",
          { value: post.id },
          "#" + post.id + " · " + (post.text || "").slice(0, 70),
        ),
      ),
    );
    $("#posts").value = S.postId;
    if (!S.postId) {
      renderOperations();
      notice("Сначала создай пост.");
      return;
    }
  }
  if (resources[S.section].noList) return;
  const data = await api("GET", basePath());
  S.items = (Array.isArray(data) ? data : [data]).map((item) => ({
    ...item,
    __key: S.section === "members" ? item.user.id : item.id,
  }));
  renderItems();
  renderForm();
}
async function loadCircles(preferred = S.circleId) {
  S.circles = await api("GET", "/circles");
  const chosen =
    S.circles.find((item) => String(item.id) === String(preferred)) ||
    S.circles[0];
  const id = String(chosen?.id || "");
  if (S.circleId !== id) {
    clearContext();
    S.section = "posts";
    S.operation = 0;
  }
  S.circleId = id;
  $("#circles").replaceChildren(
    el("option", { value: "" }, "Выбери круг"),
    ...S.circles.map((item) =>
      el("option", { value: item.id }, item.name + " (#" + item.id + ")"),
    ),
  );
  $("#circles").value = id;
  renderShell();
}
async function activate(id) {
  clearContext();
  $("#circles").replaceChildren();
  S.activeId = String(id);
  S.circleId = "";
  S.section = "posts";
  S.operation = 0;
  persist();
  renderShell();
  renderOperations();
  if (!account()) return;
  account().user = await api("GET", "/auth/me");
  persist();
  renderShell();
  await loadCircles();
  await loadList();
  notice("Выбран пользователь " + account().user.name + ".");
}
$("#operation-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const operation = resources[S.section].operations[S.operation];
  run(async () => {
    if (!S.circleId) throw new Error("Выбери круг.");
    if (operation.item && !selected())
      throw new Error("Сначала выбери запись.");
    if (S.section === "comments" && !S.postId)
      throw new Error("Сначала выбери пост.");
    let path = operation.path
      ? operation.path()
      : basePath() + operation.suffix.replace(":id", selected()?.__key);
    if (operation.confirm && !confirm(operation.label + "?")) return;
    const values = new FormData(event.target);
    const data = {};
    for (const field of operation.fields) {
      const value = String(values.get(field.name) ?? "");
      if (!value && !field.required) {
        if (field.clear) data[field.name] = null;
        continue;
      }
      data[field.name] =
        field.type === "number" || field.name === "optionId"
          ? Number(value)
          : field.type === "datetime-local"
            ? new Date(value).toISOString()
            : field.type === "lines"
              ? value
                  .split(/\r?\n/)
                  .map((line) => line.trim())
                  .filter(Boolean)
              : value;
    }
    if (operation.method === "GET" && operation.fields.length)
      path += "?" + new URLSearchParams(data);
    const result = await api(
      operation.method,
      path,
      operation.method === "GET" || operation.method === "DELETE"
        ? undefined
        : data,
    );
    if (
      S.section === "invites" &&
      operation.method === "POST" &&
      result.token
    ) {
      $("#invite-link").value = location.origin + "/invite/" + result.token;
      $("#new-invite").hidden = false;
    }
    if (operation.method !== "GET") {
      if (path.endsWith("/membership") || S.section === "settings")
        await loadCircles();
      await loadList();
    }
  }, event.submitter);
});
$("#operations").addEventListener("change", (event) => {
  S.operation = Number(event.target.value);
  renderForm();
});
$("#items").addEventListener("change", renderForm);
$("#posts").addEventListener("change", (event) => {
  S.epoch++;
  S.postId = event.target.value;
  S.items = [];
  run(loadList);
});
$("#circles").addEventListener("change", (event) => {
  clearContext();
  S.circleId = event.target.value;
  S.operation = 0;
  renderShell();
  run(loadList);
});
$("#accounts").addEventListener("change", (event) =>
  run(() => activate(event.target.value)),
);
$("#show-auth").addEventListener("click", () => {
  $("#auth").open = true;
  $("#auth-form input[name=email]").focus();
});
$("#logout").addEventListener("click", () => {
  S.accounts = S.accounts.filter((a) => String(a.user.id) !== S.activeId);
  S.activeId = "";
  S.circleId = "";
  clearContext();
  persist();
  renderShell();
  renderOperations();
  notice("Выход выполнен.");
});
$("#auth-form").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    const values = Object.fromEntries(new FormData(event.target));
    const action = event.submitter.value;
    const data =
      action === "register"
        ? values
        : { email: values.email, password: values.password };
    const { accessToken } = await api("POST", "/auth/" + action, data, null);
    const user = await api("GET", "/auth/me", undefined, accessToken);
    S.accounts = S.accounts.filter((a) => a.user.id !== user.id);
    S.accounts.push({ user, token: accessToken });
    persist();
    event.target.reset();
    await activate(user.id);
  }, event.submitter);
});
$("#create-circle").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    const created = await api(
      "POST",
      "/circles",
      Object.fromEntries(new FormData(event.target)),
    );
    event.target.reset();
    await loadCircles(created.id);
    await loadList();
    notice("Круг создан.");
  }, event.submitter);
});
$("#join").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    if (!account()) {
      $("#auth").open = true;
      throw new Error("Сначала войди или зарегистрируйся.");
    }
    let token = $("#invite-token").value.trim();
    if (/^https?:\/\//.test(token))
      token =
        new URL(token).pathname.match(/\/invite\/([a-f0-9]{64})\/?$/)?.[1] ||
        "";
    if (!/^[a-f0-9]{64}$/.test(token))
      throw new Error("Нужен токен из 64 символов или ссылка приглашения.");
    const membership = await api("POST", "/invites/" + token + "/accept");
    await loadCircles(membership.circleId);
    await loadList();
    notice("Ты вступил в круг.");
  }, event.submitter);
});
$("#copy-invite").addEventListener("click", (event) =>
  run(async () => {
    await navigator.clipboard.writeText($("#invite-link").value);
    notice("Ссылка скопирована.");
  }, event.target),
);
$("#refresh").addEventListener("click", (event) => run(loadList, event.target));
$("#refresh-circles").addEventListener("click", (event) =>
  run(async () => {
    await loadCircles();
    await loadList();
  }, event.target),
);
$("#health").addEventListener("click", (event) =>
  run(async () => {
    await api("GET", "/", undefined, null);
  }, event.target),
);
$("#manual").addEventListener("submit", (event) => {
  event.preventDefault();
  run(async () => {
    const values = Object.fromEntries(new FormData(event.target));
    if (!values.path.startsWith("/") || values.path.startsWith("//"))
      throw new Error("Укажи путь API, например /circles.");
    const data =
      values.method === "GET" || !values.body.trim()
        ? undefined
        : JSON.parse(values.body);
    await api(values.method, values.path, data);
  }, event.submitter);
});
const incoming = location.pathname.match(/^\/invite\/([a-f0-9]{64})\/?$/);
if (incoming) {
  $("#invite-token").value = incoming[1];
  $("#invite-hint").hidden = false;
}
renderShell();
renderOperations();
if (account()) run(() => activate(S.activeId));
