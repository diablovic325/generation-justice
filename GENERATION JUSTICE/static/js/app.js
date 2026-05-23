const state = {
    user: null,
    canModerateComments: false,
};

const GJ_API_MSG = {
    "Request failed.": "msg.requestFailed",
    "You are logged in.": "msg.loggedIn",
    "You are logged out.": "msg.loggedOut",
    "Application approved.": "msg.applicationApproved",
    "Essay submitted for the monthly competition.": "msg.essaySubmitted",
    "Article submitted for editorial review.": "msg.articleSubmitted",
    "Internship application received.": "msg.internshipReceived",
    "Comment deleted.": "msg.commentDeleted",
    "Apply or log in before using this member feature.": "err.loginRequired",
    "Email and password are required.": "err.emailPasswordRequired",
    "Incorrect email or password.": "err.invalidCredentials",
    "Name, address, country, email, phone, and a password with at least 4 characters are required.": "err.applyFields",
    "Comment text is required.": "err.commentRequired",
    "Only organizer-level accounts can delete comments.": "err.moderatorOnly",
    "Comment was not found.": "err.commentNotFound",
    "Topic title and body are required.": "err.topicRequired",
    "Reply text is required.": "err.replyRequired",
    "Discussion topic was not found.": "err.topicNotFound",
    "Essay title, country, and summary are required.": "err.essayRequired",
    "Article title, category, and abstract are required.": "err.articleRequired",
    "Please explain why you want to volunteer for this project.": "err.motivationRequired",
    "Project was not found.": "err.projectNotFound",
};

function gjMsg(text) {
    if (!text) return text;
    const key = GJ_API_MSG[text];
    return key && typeof gjT === "function" ? gjT(key) : text;
}

function gjAfterInsert(node) {
    if (node && typeof gjRefreshSubtree === "function") gjRefreshSubtree(node);
}

const loginPresets = {
    member: {
        email: "demo@generationjustice.org",
        password: "demo123",
        redirect: "/hub",
    },
    organizer: {
        email: "organizer@generationjustice.org",
        password: "organizer123",
        redirect: "/comments",
    },
    admin: {
        email: "admin@generationjustice.org",
        password: "admin123",
        redirect: "/hub",
    },
};

function qs(selector, root = document) {
    return root.querySelector(selector);
}

function qsa(selector, root = document) {
    return Array.from(root.querySelectorAll(selector));
}

function setStatus(element, message, type = "ok") {
    if (!element) return;
    element.textContent = gjMsg(message);
    element.className = "status show " + type;
}

function clearStatus(element) {
    if (!element) return;
    element.textContent = "";
    element.className = "status";
}

async function postJson(url, data) {
    const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
    });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(gjMsg(payload.detail || "Request failed."));
    }
    return payload;
}

async function deleteJson(url) {
    const response = await fetch(url, { method: "DELETE" });
    const payload = await response.json();
    if (!response.ok) {
        throw new Error(gjMsg(payload.detail || "Request failed."));
    }
    return payload;
}

function setLoginMode(mode = "member") {
    const preset = loginPresets[mode] || loginPresets.member;
    const modal = qs("#loginModal");
    if (modal) modal.dataset.loginMode = mode;
    if (qs("#loginEmail")) qs("#loginEmail").value = preset.email;
    if (qs("#loginPassword")) qs("#loginPassword").value = preset.password;
    if (typeof gjApplyLoginMode === "function") gjApplyLoginMode(mode);
}

function openLogin(mode = "member") {
    const modal = qs("#loginModal");
    if (!modal) return;
    setLoginMode(mode);
    modal.classList.add("open");
    modal.setAttribute("aria-hidden", "false");
}

function closeLogin() {
    const modal = qs("#loginModal");
    if (!modal) return;
    modal.classList.remove("open");
    modal.setAttribute("aria-hidden", "true");
}

function updateAuthUI(user) {
    state.user = user;
    state.canModerateComments = Boolean(user?.can_moderate_comments);
    const chip = qs("#memberChip");
    const logoutButton = qs("#logoutButton");
    const loginButtons = qsa("[data-login-mode]");

    if (user) {
        if (chip) {
            const levelKey = (window.LEVEL_I18N_KEYS || {})[user.membership] || "level.member";
            chip.innerHTML =
                `<span data-i18n="${levelKey}">${user.membership}</span> <span data-i18n="member.chipSuffix">Member</span>`;
            chip.classList.add("show");
            gjAfterInsert(chip);
        }
        loginButtons.forEach((button) => button.classList.add("hidden"));
        logoutButton?.classList.remove("hidden");
        const commentName = qs("#commentName");
        if (commentName && !commentName.value) commentName.value = user.name;
    } else {
        chip?.classList.remove("show");
        loginButtons.forEach((button) => button.classList.remove("hidden"));
        logoutButton?.classList.add("hidden");
    }
    syncCommentModerationButtons();
}

async function loadCurrentUser() {
    try {
        const response = await fetch("/api/me");
        const payload = await response.json();
        updateAuthUI(payload.user);
    } catch {
        updateAuthUI(null);
    }
}

function maybeOpenLogin(error) {
    if (error.message.toLowerCase().includes("log in") || error.message.toLowerCase().includes("apply")) {
        openLogin("member");
    }
}

function createDeleteCommentButton(commentId) {
    const button = document.createElement("button");
    button.className = "danger-button delete-comment";
    button.type = "button";
    button.dataset.commentId = commentId;
    button.dataset.i18n = "comments.delete";
    button.textContent = typeof gjT === "function" ? gjT("comments.delete") : "Delete Comment";
    return button;
}

function syncCommentModerationButtons() {
    qsa(".comment").forEach((comment) => {
        const existing = qs(".delete-comment", comment);
        if (state.canModerateComments && comment.dataset.commentId && !existing) {
            comment.appendChild(createDeleteCommentButton(comment.dataset.commentId));
        }
        if (!state.canModerateComments && existing) {
            existing.remove();
        }
    });
}

function makeComment(comment) {
    const item = document.createElement("article");
    item.className = "comment";
    item.dataset.commentId = comment.id;
    item.innerHTML = "<strong></strong><small></small><p></p>";
    qs("strong", item).textContent = comment.user_name;
    qs("small", item).textContent = comment.created_at;
    qs("p", item).textContent = comment.text;
    if (state.canModerateComments) {
        item.appendChild(createDeleteCommentButton(comment.id));
    }
    return item;
}

function makeMiniItem(item, textKey = "summary") {
    const article = document.createElement("article");
    article.className = "mini-item";
    article.innerHTML = "<strong></strong><small></small><p></p>";
    qs("strong", article).textContent =
        item.title || item.country || (typeof gjT === "function" ? gjT("empty.submission") : "Submission");
    qs("small", article).textContent = (item.submitted_at || "") + " - " + (item.status || "");
    qs("p", article).textContent = item[textKey] || item.summary || item.abstract || item.motivation || "";
    return article;
}

function makeReply(reply) {
    const item = document.createElement("article");
    item.className = "reply";
    item.innerHTML = "<strong></strong><small></small><p></p>";
    qs("strong", item).textContent = reply.created_by;
    qs("small", item).textContent = reply.created_at;
    qs("p", item).textContent = reply.body;
    return item;
}

function makeTopic(topic) {
    const item = document.createElement("article");
    item.className = "discussion-topic";
    item.dataset.topicId = topic.id;
    item.innerHTML = `
        <div class="topic-head">
            <div>
                <h2></h2>
                <small><span data-i18n="dyn.startedBy">Started by</span> <span class="topic-author"></span> - <span class="topic-date"></span></small>
            </div>
        </div>
        <p class="topic-body"></p>
        <div class="reply-list"></div>
        <form class="reply-form">
            <label data-i18n-label="disc.replyLabel">
                Reply with a detailed comment
                <textarea name="replyBody" data-i18n-placeholder="disc.replyPh" placeholder="Write a thoughtful reply..." required></textarea>
            </label>
            <button class="button secondary" type="submit" data-i18n="disc.postReply">Post Reply</button>
            <div class="status"></div>
        </form>
    `;
    qs("h2", item).textContent = topic.title;
    qs(".topic-author", item).textContent = topic.created_by;
    qs(".topic-date", item).textContent = topic.created_at;
    qs(".topic-body", item).textContent = topic.body;
    qsa(".reply-form", item).forEach((form) => {
        form.dataset.topicId = topic.id;
    });
    gjAfterInsert(item);
    return item;
}

function bindLogin() {
    qsa("[data-login-mode]").forEach((button) => {
        button.addEventListener("click", () => openLogin(button.dataset.loginMode));
    });
    qsa("[data-open-login]").forEach((button) => button.addEventListener("click", () => openLogin("member")));
    qs("#closeLoginButton")?.addEventListener("click", closeLogin);

    qs("#loginModal")?.addEventListener("click", (event) => {
        if (event.target.id === "loginModal") closeLogin();
    });

    qs("#loginForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = qs("#loginStatus");
        clearStatus(status);
        try {
            const payload = await postJson("/api/login", {
                email: qs("#loginEmail").value,
                password: qs("#loginPassword").value,
            });
            updateAuthUI(payload.user);
            setStatus(status, payload.message);
            setTimeout(() => {
                const mode = qs("#loginModal")?.dataset.loginMode || "member";
                const redirect = loginPresets[mode]?.redirect || "/hub";
                closeLogin();
                if (mode === "organizer" || mode === "admin" || location.pathname === "/membership") {
                    location.href = redirect;
                }
            }, 700);
        } catch (error) {
            setStatus(status, error.message, "error");
        }
    });

    qs("#logoutButton")?.addEventListener("click", async () => {
        await postJson("/api/logout", {});
        updateAuthUI(null);
        location.href = "/";
    });
}

function formCheckboxesValid(form) {
    if (!form) return true;
    const boxes = qsa('input[type="checkbox"][required]', form);
    const missing = boxes.filter((box) => !box.checked);
    return missing.length === 0;
}

function bindApplication() {
    qs("#applicationForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        const status = qs("#applicationStatus");
        clearStatus(status);
        if (!formCheckboxesValid(form)) {
            setStatus(status, typeof gjT === "function" ? gjT("msg.checkboxes") : "Please confirm all required declarations before submitting.", "error");
            return;
        }
        try {
            const payload = await postJson("/api/apply", {
                name: qs("#applyName").value,
                address: qs("#applyAddress").value,
                city: qs("#applyCity").value,
                country: qs("#applyCountry").value,
                email: qs("#applyEmail").value,
                phone: qs("#applyPhone").value,
                organization: qs("#applyOrganization").value,
                password: qs("#applyPassword").value,
                membership: qs("#applyMembership").value,
                interests: "",
            });
            updateAuthUI(payload.user);
            setStatus(status, payload.message);
            const certificate = qs("#applicationCertificate");
            if (certificate) {
                certificate.classList.remove("hidden");
                qs("#certificateNamePreview").textContent = payload.user.name;
                qs("#certificateNumberPreview").textContent = payload.user.registration_number;
            }
        } catch (error) {
            setStatus(status, error.message, "error");
        }
    });
}

function bindComments() {
    qs("#commentForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = qs("#commentStatus");
        clearStatus(status);
        try {
            const payload = await postJson("/api/comments", {
                name: qs("#commentName")?.value || "",
                text: qs("#commentText").value,
            });
            const commentNode = makeComment(payload.comment);
            qs("#commentList")?.prepend(commentNode);
            gjAfterInsert(commentNode);
            qs("#commentText").value = "";
            setStatus(status, typeof gjT === "function" ? gjT("msg.commentPosted") : "Comment posted.");
        } catch (error) {
            setStatus(status, error.message, "error");
            maybeOpenLogin(error);
        }
    });

    qs("#commentList")?.addEventListener("click", async (event) => {
        const button = event.target.closest(".delete-comment");
        if (!button) return;
        const commentId = button.dataset.commentId;
        const comment = button.closest(".comment");
        button.disabled = true;
        try {
            await deleteJson("/api/comments/" + commentId);
            comment?.remove();
        } catch (error) {
            button.disabled = false;
            alert(gjMsg(error.message));
            maybeOpenLogin(error);
        }
    });
}

function bindDiscussions() {
    qs("#topicForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = qs("#topicStatus");
        clearStatus(status);
        try {
            const payload = await postJson("/api/discussions/topics", {
                title: qs("#topicTitle").value,
                body: qs("#topicBody").value,
            });
            const topicNode = makeTopic(payload.topic);
            qs("#discussionList")?.prepend(topicNode);
            event.target.reset();
            setStatus(status, typeof gjT === "function" ? gjT("msg.topicLaunched") : "Discussion topic launched.");
        } catch (error) {
            setStatus(status, error.message, "error");
            maybeOpenLogin(error);
        }
    });

    qs("#discussionList")?.addEventListener("submit", async (event) => {
        if (!event.target.classList.contains("reply-form")) return;
        event.preventDefault();
        const form = event.target;
        const status = qs(".status", form);
        clearStatus(status);
        try {
            const payload = await postJson("/api/discussions/replies", {
                topic_id: Number(form.dataset.topicId),
                body: qs("textarea", form).value,
            });
            const replyNode = makeReply(payload.reply);
            form.closest(".discussion-topic").querySelector(".reply-list").appendChild(replyNode);
            form.reset();
            setStatus(status, typeof gjT === "function" ? gjT("msg.replyPosted") : "Reply posted.");
        } catch (error) {
            setStatus(status, error.message, "error");
            maybeOpenLogin(error);
        }
    });
}

function bindEssays() {
    qs("#essayForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = qs("#essayStatus");
        clearStatus(status);
        try {
            const payload = await postJson("/api/essays", {
                title: qs("#essayTitle").value,
                country: qs("#essayCountry").value,
                summary: qs("#essaySummary").value,
            });
            qs("#essaySubmissionList")?.prepend(makeMiniItem(payload.entry, "summary"));
            event.target.reset();
            setStatus(status, payload.message);
        } catch (error) {
            setStatus(status, error.message, "error");
            maybeOpenLogin(error);
        }
    });
}

function bindArticles() {
    qs("#articleForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = qs("#articleStatus");
        clearStatus(status);
        try {
            const payload = await postJson("/api/articles", {
                title: qs("#articleTitle").value,
                category: qs("#articleCategory").value,
                abstract: qs("#articleAbstract").value,
            });
            qs("#articleSubmissionList")?.prepend(makeMiniItem(payload.article, "abstract"));
            event.target.reset();
            setStatus(status, payload.message);
        } catch (error) {
            setStatus(status, error.message, "error");
            maybeOpenLogin(error);
        }
    });
}

function bindInternships() {
    qs("#internshipForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = qs("#internshipStatus");
        clearStatus(status);
        try {
            const payload = await postJson("/api/internships/apply", {
                project_id: Number(qs("#internshipProject").value),
                motivation: qs("#internshipMotivation").value,
            });
            qs("#internshipSubmissionList")?.prepend(makeMiniItem(payload.application, "motivation"));
            event.target.reset();
            setStatus(status, payload.message);
        } catch (error) {
            setStatus(status, error.message, "error");
            maybeOpenLogin(error);
        }
    });
}

function bindAmbassadorApplication() {
    qs("#ambassadorApplicationForm")?.addEventListener("submit", async (event) => {
        event.preventDefault();
        const form = event.target;
        const status = qs("#ambassadorApplicationStatus");
        clearStatus(status);
        if (!formCheckboxesValid(form)) {
            setStatus(status, typeof gjT === "function" ? gjT("msg.checkboxes") : "Please confirm all required declarations before submitting.", "error");
            return;
        }
        try {
            const motivation = qs("#ambMotivation").value.trim();
            const payload = await postJson("/api/apply", {
                name: qs("#ambName").value,
                address: qs("#ambAddress").value,
                city: "",
                country: qs("#ambCountry").value,
                email: qs("#ambEmail").value,
                phone: qs("#ambPhone").value,
                organization: qs("#ambUniversity").value + " (Year " + qs("#ambYear").value + ")",
                password: qs("#ambPassword").value,
                membership: "Ambassador",
                interests: motivation,
            });
            updateAuthUI(payload.user);
            setStatus(status, payload.message);
            setTimeout(() => {
                location.href = "/certificate";
            }, 900);
        } catch (error) {
            setStatus(status, error.message, "error");
        }
    });
}

document.addEventListener("gj:language-changed", () => {
    const mode = qs("#loginModal")?.dataset.loginMode || "member";
    if (typeof gjApplyLoginMode === "function") gjApplyLoginMode(mode);
});

document.addEventListener("DOMContentLoaded", () => {
    bindLogin();
    bindApplication();
    bindAmbassadorApplication();
    bindComments();
    bindDiscussions();
    bindEssays();
    bindArticles();
    bindInternships();
    loadCurrentUser();
});
