// Layer 2: adapters. Turn Brightspace responses into Canvas-shaped objects.
// Field names follow the Canvas API (course_code, due_at, points_possible, html_url).
// html_url always points at the original Brightspace page for the item.
BSX.data = (() => {
  const { client } = BSX;
  const DAY = 864e5;

  // A tool that is switched off, not permitted or broken counts as empty, not as a failure.
  // Signed-out (401) and throttled (429) answers still surface, since they affect everything.
  const soft = (promise, fallback) =>
    promise.catch((e) => {
      if (e instanceof client.ApiError && e.status !== 401 && e.status !== 429) return fallback;
      throw e;
    });
  const list = (v) => (Array.isArray(v) ? v : v && Array.isArray(v.Objects) ? v.Objects : []);
  const sameId = (a, b) => a != null && b != null && String(a) === String(b);

  // ---- courses -------------------------------------------------------------
  // Term code as it appears inside course codes, e.g. wl.202710.CS.18000: the academic
  // year that ends, then 10 fall, 20 spring, 30 summer. Fall 2026 is 202710.
  function currentTermCode(date = new Date()) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    if (m >= 8) return `${y + 1}10`;
    if (m <= 5) return `${y}20`;
    return `${y}30`;
  }

  async function courses() {
    const [items, imageBase] = await Promise.all([client.lpBookmarked('enrollments/myenrollments/'), client.lpPath('courses')]);
    const now = Date.now();
    const term = new RegExp(`(^|[^0-9])${currentTermCode()}([^0-9]|$)`);
    return items
      .filter(
        (e) =>
          e.OrgUnit?.Type?.Code === 'Course Offering' &&
          e.Access?.CanAccess !== false &&
          e.Access?.IsActive !== false &&
          (!e.Access?.EndDate || Date.parse(e.Access.EndDate) > now)
      )
      .map((e) => ({
        id: e.OrgUnit.Id,
        name: e.OrgUnit.Name,
        course_code: e.OrgUnit.Code,
        image_url: `${imageBase}/${e.OrgUnit.Id}/image`,
        current_term: term.test(e.OrgUnit.Code || ''),
        pinned: Boolean(e.PinDate),
        last_accessed: e.Access?.LastAccessed || null,
      }))
      .sort(
        (a, b) =>
          b.current_term - a.current_term || b.pinned - a.pinned || Date.parse(b.last_accessed || 0) - Date.parse(a.last_accessed || 0)
      );
  }

  // The organisation's own org unit id, which Brightspace-wide tools such as Email hang off.
  async function orgId() {
    const items = await client.lpBookmarked('enrollments/myenrollments/');
    return items.find((e) => e.OrgUnit?.Type?.Code === 'Organization')?.OrgUnit.Id ?? null;
  }

  async function me() {
    const w = await client.lp('users/whoami');
    return { id: w.Identifier, name: [w.FirstName, w.LastName].filter(Boolean).join(' ') || w.UniqueName || '', login: w.UniqueName || '' };
  }

  // Unread counts for a course card.
  async function updates(ou) {
    const u = await soft(client.le(`${ou}/updates/myUpdates`), null);
    return { discussions: u?.UnreadDiscussions || 0, feedback: u?.UnreadAssignmentFeedback || 0, quizzes: u?.UnattemptedQuizzes || 0 };
  }

  // ---- grade values --------------------------------------------------------
  const gradeValues = (ou) => soft(client.le(`${ou}/grades/values/myGradeValues/`), []);

  // A score Brightspace only gives as display text ("0 / 10", "7.5/10") when the number is missing.
  const shownScore = (v) => {
    const m = String(v.DisplayedGrade || '').match(/^\s*(-?\d+(?:\.\d+)?)\s*\/\s*\d/);
    return m ? Number(m[1]) : null;
  };
  const toValue = (v) =>
    v && {
      score: v.PointsNumerator ?? shownScore(v),
      points_possible: v.PointsDenominator,
      weighted_score: v.WeightedNumerator,
      weighted_possible: v.WeightedDenominator,
      displayed: v.DisplayedGrade || '',
      comment: v.Comments?.Text || '',
      graded_at: v.LastModified || null,
    };

  // ---- assignments, quizzes, discussions -----------------------------------
  // Dropbox SubmissionType: 0 file, 1 text, 2 on paper, 3 observed in person, 4 file or text.
  // SubmissionsRule: 2 keep all, 3 overwrite, 4 only one.
  const mapFolder = (f, ou, grade) => ({
    id: `assignment-${f.Id}`,
    source_id: f.Id,
    kind: 'assignment',
    name: f.Name,
    due_at: f.DueDate || null,
    points_possible: f.Assessment?.ScoreDenominator ?? null,
    grade_item_id: f.GradeItemId ?? null,
    grade,
    submission_type: f.SubmissionType ?? 0,
    submissions_rule: f.SubmissionsRule ?? null,
    unlock_at: f.Availability?.StartDate || null,
    lock_at: f.Availability?.EndDate || null,
    allowed_extensions: f.AllowableFileType === 5 && Array.isArray(f.CustomAllowableFileTypes) ? f.CustomAllowableFileTypes.map(String) : null,
    html_url: `/d2l/lms/dropbox/user/folder_submit_files.d2l?db=${f.Id}&ou=${ou}`,
  });

  // Rubric as Brightspace describes it, flattened to one row per criterion.
  // ScoringMethod: 0 text only, 1 points, 2 text and numeric, 3 custom points.
  const rtext = (r) => (r ? r.Text || '' : '');
  const mapRubric = (r) => ({
    id: r.RubricId,
    name: r.Name || 'Rubric',
    description: rtext(r.Description),
    points: r.ScoringMethod != null && r.ScoringMethod !== 0,
    criteria: (r.CriteriaGroups || []).flatMap((g) =>
      (g.Criteria || []).map((c) => ({
        id: c.Id,
        name: c.Name,
        group: g.Name || '',
        levels: (g.Levels || []).map((l, i) => ({ id: l.Id, name: l.Name, points: c.Cells?.[i]?.Points ?? l.Points ?? null, description: rtext(c.Cells?.[i]?.Description) })),
      }))
    ),
    overall: (r.OverallLevels || []).map((l) => ({ id: l.Id, name: l.Name, from: l.RangeStart ?? l.RangeStartPoints ?? null, description: rtext(l.Description) })),
  });
  const mapAssessment = (x) => {
    const o = x.OverallOutcome || x.OverallLevel || {};
    return {
      rubric_id: x.RubricId,
      score: o.Score ?? x.OverallScore ?? null,
      level_id: o.LevelId ?? null,
      feedback: rtext(o.Feedback || x.OverallFeedback),
      criteria: (x.CriteriaOutcome || []).map((c) => ({ id: c.CriterionId, level_id: c.LevelId ?? null, score: c.Score ?? null, feedback: rtext(c.Feedback) })),
    };
  };

  const mapQuiz = (q, ou, grade) => ({
    id: `quiz-${q.QuizId}`,
    source_id: q.QuizId,
    kind: 'quiz',
    name: q.Name,
    due_at: q.DueDate || q.EndDate || null,
    points_possible: null,
    grade_item_id: q.GradeItemId ?? null,
    grade,
    html_url: `/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${q.QuizId}&ou=${ou}`, // the page with Start Quiz
  });

  const mapTopic = (t, ou) => ({
    id: `discussion-${t.TopicId}`,
    source_id: t.TopicId,
    forum_id: t.ForumId,
    kind: 'discussion',
    name: t.Name,
    forum: t.forumName || null,
    due_at: t.DueDate || t.EndDate || null,
    points_possible: t.ScoreOutOf ?? null,
    grade_item_id: null,
    grade: null,
    locked: Boolean(t.IsLocked),
    html_url: `/d2l/le/${ou}/discussions/topics/${t.TopicId}/View`,
  });

  const folders = (ou) => soft(client.le(`${ou}/dropbox/folders/`), []);
  const quizList = (ou) => soft(client.leObjects(`${ou}/quizzes/`), []);

  async function topicList(ou) {
    const forums = list(await soft(client.le(`${ou}/discussions/forums/`), [])).filter((f) => !f.IsHidden);
    const perForum = await Promise.all(
      forums.map((f) =>
        soft(client.le(`${ou}/discussions/forums/${f.ForumId}/topics/`), [])
          .then((topics) => list(topics).map((t) => ({ ...t, ForumId: t.ForumId ?? f.ForumId, forumName: f.Name })))
          .catch(() => [])
      )
    );
    return perForum.flat().filter((t) => !t.IsHidden);
  }

  // Every discussion topic in the course, flattened out of its forums.
  const discussions = async (ou) => (await topicList(ou)).map((t) => mapTopic(t, ou));

  // Assignments, quizzes and discussion topics merged into one Canvas-style list.
  async function assignments(ou) {
    const [fs, qs, values, topics] = await Promise.all([folders(ou), quizList(ou), gradeValues(ou), discussions(ou).catch(() => [])]);
    const byItem = new Map(values.map((v) => [String(v.GradeObjectIdentifier), v]));
    const grade = (id) => (id == null ? null : toValue(byItem.get(String(id))) || null);
    return [
      ...fs.filter((f) => !f.IsHidden).map((f) => mapFolder(f, ou, grade(f.GradeItemId))),
      ...qs.filter((q) => q.IsActive !== false).map((q) => mapQuiz(q, ou, grade(q.GradeItemId))),
      ...topics,
    ];
  }

  // Grade item id -> grade category name, for "show by type" on the assignment list.
  async function assignmentGroups(ou) {
    const [items, categories] = await Promise.all([soft(client.le(`${ou}/grades/`), []), soft(client.le(`${ou}/grades/categories/`), [])]);
    const names = new Map(categories.map((c) => [c.Id, c.Name]));
    return new Map(items.map((i) => [String(i.Id), names.get(i.CategoryId) || null]));
  }

  // Dropbox status codes: 0 unsubmitted, 1 submitted, 2 draft, 3 feedback published.
  // An entry can exist for an empty or draft submission, so require a date or files too.
  async function submissionEntries(ou, folderId) {
    return list(await soft(client.le(`${ou}/dropbox/folders/${folderId}/submissions/mysubmissions/`), []));
  }

  // `base` is the folder's API address; with it, files get addresses they can be downloaded from.
  function readSubmission(entries, base = null) {
    const out = { submitted: false, submitted_at: null, status: 'unsubmitted', submissions: [], feedback: null };
    for (const e of entries) {
      const subs = (e.Submissions || []).map((s) => ({
        id: s.Id,
        submitted_at: s.SubmissionDate || null,
        comment: s.Comment?.Text || '',
        files: (s.Files || []).filter((f) => !f.IsDeleted).map((f) => ({ name: f.FileName, size: f.Size, url: base && s.Id != null ? `${base}/submissions/${s.Id}/files/${f.FileId}` : null })),
      }));
      const real = subs.some((s) => s.submitted_at || s.files.length);
      if ((e.Status === 1 || e.Status === 3) && real) {
        out.submitted = true;
        out.status = e.Status === 3 ? 'graded' : 'submitted';
      } else if (e.Status === 2 && !out.submitted) {
        out.status = 'draft';
      }
      out.submissions.push(...subs);
      const fb = e.Feedback;
      const fbFiles = fb?.Files || [];
      const fbLinks = fb?.Links || [];
      const rubrics = fb?.RubricAssessments || [];
      if (fb && (fb.Score != null || fb.Feedback?.Text || fb.Feedback?.Html || fbFiles.length || fbLinks.length || rubrics.length)) {
        const who = e.Entity && e.Entity.EntityId != null ? `${String(e.Entity.EntityType || 'User').toLowerCase()}/${e.Entity.EntityId}` : null;
        out.feedback = {
          score: fb.Score ?? null,
          comment_html: fb.Feedback?.Html || '',
          comment: fb.Feedback?.Text || '',
          graded: Boolean(fb.IsGraded),
          files: fbFiles.map((f) => ({ name: f.FileName, size: f.Size, url: base && who ? `${base}/feedback/${who}/attachments/${f.FileId}` : null })),
          links: fbLinks.map((l) => ({ name: l.LinkName || l.Name || 'Link', url: l.Href || l.Url || null })).filter((l) => l.url),
          rubrics: rubrics.map(mapAssessment),
        };
      }
    }
    out.submissions.sort((a, b) => Date.parse(b.submitted_at || 0) - Date.parse(a.submitted_at || 0));
    out.submitted_at = out.submitted ? out.submissions.find((s) => s.submitted_at)?.submitted_at || null : null;
    return out;
  }

  async function submission(ou, folderId) {
    const s = readSubmission(await submissionEntries(ou, folderId));
    return { submitted: s.submitted, submitted_at: s.submitted_at };
  }

  // One assignment with its instructions, the student's submissions and any feedback.
  async function assignment(ou, folderId) {
    const [fs, entries, values, base] = await Promise.all([folders(ou), submissionEntries(ou, folderId), gradeValues(ou), client.lePath(`${ou}/dropbox/folders/${folderId}`)]);
    const f = fs.find((x) => sameId(x.Id, folderId));
    if (!f) return null;
    const v = values.find((x) => sameId(x.GradeObjectIdentifier, f.GradeItemId));
    return {
      ...mapFolder(f, ou, toValue(v) || null),
      description_html: f.CustomInstructions?.Html || '',
      description: f.CustomInstructions?.Text || '',
      attachments: (f.Attachments || []).map((a) => ({ name: a.FileName, size: a.Size, url: `${base}/attachments/${a.FileId}` })),
      links: (f.LinkAttachments || []).map((l) => ({ name: l.LinkName || l.Name || 'Link', url: l.Href || l.Url || null })).filter((l) => l.url),
      rubrics: (f.Assessment?.Rubrics || []).map(mapRubric),
      ...readSubmission(entries, base),
    };
  }

  // Can the student hand in this assignment from the wrapper? Brightspace's student
  // route takes one file (and an optional comment) per submission.
  function canSubmit(a, now = Date.now()) {
    if (a.submission_type !== 0 && a.submission_type !== 4) return { ok: false, why: 'This assignment is not a file upload.' };
    if (a.unlock_at && Date.parse(a.unlock_at) > now) return { ok: false, why: 'This assignment is not open yet.' };
    if (a.lock_at && Date.parse(a.lock_at) < now) return { ok: false, why: 'This assignment is closed.' };
    if (a.submissions_rule === 4 && a.submitted) return { ok: false, why: 'Only one submission is allowed, and you have already submitted.' };
    return { ok: true, why: null };
  }

  // Hand in one file, with an optional comment, as the signed-in student.
  // Sent as Brightspace documents it: multipart/mixed, a JSON comment then the file.
  async function submit(ou, folderId, file, comment = '') {
    const boundary = `bsx${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
    const safe = String(file.name || 'file').replace(/["\r\n\\]/g, '_');
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json\r\n\r\n`,
      JSON.stringify({ Text: comment || '', Html: null }),
      `\r\n--${boundary}\r\nContent-Disposition: form-data; name=""; filename="${safe}"; filename*=UTF-8''${encodeURIComponent(file.name || 'file')}\r\nContent-Type: ${file.type || 'application/octet-stream'}\r\n\r\n`,
      file,
      `\r\n--${boundary}--\r\n`,
    ]);
    await client.send(`${ou}/dropbox/folders/${folderId}/submissions/mysubmissions/`, { body, type: `multipart/mixed;boundary=${boundary}` });
    client.clear();
    const after = readSubmission(await submissionEntries(ou, folderId));
    return { submitted: after.submitted, submitted_at: after.submitted_at };
  }

  // How many attempts the student has made on a quiz. `known` is false when Brightspace
  // will not say (the endpoint is refused for some roles), so callers must not guess.
  async function quizAttempts(ou, quizId) {
    const [attempts, who] = await Promise.all([
      soft(client.leObjects(`${ou}/quizzes/${quizId}/attempts/`), null),
      client.lp('users/whoami').catch(() => null),
    ]);
    if (!attempts) return quizSummary(ou, quizId);
    const mine = attempts.filter((a) => a.UserId == null || !who || sameId(a.UserId, who.Identifier));
    // An attempt has a Completed time once it is handed in; one without is still open.
    const finished = mine.filter((a) => !('Completed' in a) || a.Completed);
    return { known: true, attempts_used: finished.length, in_progress: mine.length - finished.length };
  }

  // Where the attempts list is refused to students (as at Purdue), Brightspace's own quiz
  // summary page still states the attempts allowed, completed and remaining. Read that
  // page's text; opening it does not start an attempt.
  function parseQuizSummary(html) {
    const text = String(html || '')
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;|&#160;/g, ' ')
      .replace(/\s+/g, ' ');
    const grab = (re) => {
      const m = text.match(re);
      return m ? (/unlimited/i.test(m[1]) ? Infinity : Number(m[1])) : null;
    };
    const SEP = '\\s*[-:–]?\\s*';
    const completed = grab(new RegExp(`(?:Attempts?\\s+Completed|Completed(?:\\s+Attempts?)?)${SEP}(\\d+)(?![\\d/:.])`, 'i'));
    const allowed = grab(new RegExp(`(?:Attempts?\\s+Allowed|Allowed(?:\\s+Attempts?)?)${SEP}(\\d+(?![\\d/:.])|Unlimited)`, 'i'));
    const remaining = grab(new RegExp(`(?:Attempts?\\s+Remaining|Remaining(?:\\s+Attempts?)?)${SEP}(\\d+(?![\\d/:.])|Unlimited)`, 'i'));
    let used = completed;
    if (used == null && Number.isFinite(allowed) && Number.isFinite(remaining)) used = Math.max(0, allowed - remaining);
    if (used == null) return { known: false, attempts_used: 0, in_progress: 0 };
    return {
      known: true,
      attempts_used: used,
      in_progress: 0,
      allowed: allowed === Infinity ? null : allowed,
      remaining: remaining === Infinity ? null : remaining ?? (Number.isFinite(allowed) ? Math.max(0, allowed - used) : null),
      source: 'summary',
    };
  }

  async function quizSummary(ou, quizId) {
    const html = await client.page(`/d2l/lms/quizzing/user/quiz_summary.d2l?qi=${encodeURIComponent(quizId)}&ou=${encodeURIComponent(ou)}`).catch((e) => {
      if (e instanceof client.ApiError && e.status === 401) throw e;
      return '';
    });
    return parseQuizSummary(html);
  }

  async function quiz(ou, quizId) {
    const [qs, values, attempts] = await Promise.all([quizList(ou), gradeValues(ou), quizAttempts(ou, quizId).catch(() => ({ known: false, attempts_used: 0 }))]);
    const q = qs.find((x) => sameId(x.QuizId, quizId));
    if (!q) return null;
    const v = values.find((x) => sameId(x.GradeObjectIdentifier, q.GradeItemId));
    const shown = (part) => (part && part.IsDisplayed !== false ? part.Text : null);
    return {
      ...mapQuiz(q, ou, toValue(v) || null),
      description_html: shown(q.Description)?.Html || '',
      description: shown(q.Description)?.Text || '',
      instructions_html: shown(q.Instructions)?.Html || '',
      instructions: shown(q.Instructions)?.Text || '',
      unlock_at: q.StartDate || null,
      lock_at: q.EndDate || null,
      real_due_at: q.DueDate || null,
      time_limit: q.SubmissionTimeLimit?.IsEnforced ? q.SubmissionTimeLimit.TimeLimitValue : null,
      allowed_attempts: q.AttemptsAllowed?.IsUnlimited ? null : q.AttemptsAllowed?.NumberOfAttemptsAllowed ?? null,
      attempts,
    };
  }

  const topicPosts = async (ou, forumId, topicId) => list(await soft(client.le(`${ou}/discussions/forums/${forumId}/topics/${topicId}/posts/?sort=creationdate&pageSize=1000`), []));

  // Has the student posted in a topic? Each post records who wrote it.
  async function posted(ou, forumId, topicId) {
    const [raw, who] = await Promise.all([topicPosts(ou, forumId, topicId), client.lp('users/whoami')]);
    return raw.some((p) => !p.IsDeleted && sameId(p.PostingUserId, who.Identifier));
  }

  // Post in a discussion topic as the student: a new thread (no parent) or a reply.
  // Brightspace's CreatePostData: { ParentPostId, Subject, Message: { Content, Type }, IsAnonymous }.
  async function post(ou, forumId, topicId, { parentId = null, subject = '', message }) {
    const body = JSON.stringify({ ParentPostId: parentId, Subject: subject || '', Message: { Content: message, Type: 'Text' }, IsAnonymous: false });
    await client.send(`${ou}/discussions/forums/${forumId}/topics/${topicId}/posts/`, { body, type: 'application/json' });
    client.clear();
  }

  // One discussion topic with its posts.
  async function discussion(ou, topicId) {
    const t = (await topicList(ou)).find((x) => sameId(x.TopicId, topicId));
    if (!t) return null;
    const [raw, who] = await Promise.all([topicPosts(ou, t.ForumId, t.TopicId), client.lp('users/whoami').catch(() => null)]);
    const posts = raw
      .filter((p) => !p.IsDeleted)
      .map((p) => ({
        id: p.PostId,
        parent_id: p.ParentPostId || null,
        subject: p.Subject || '',
        message_html: p.Message?.Html || '',
        message: p.Message?.Text || '',
        author: p.IsAnonymous ? 'Anonymous' : p.PostingUserDisplayName || 'Unknown',
        mine: Boolean(who) && sameId(p.PostingUserId, who.Identifier),
        unread: p.IsRead === false,
        posted_at: p.DatePosted || null,
      }))
      .sort((a, b) => Date.parse(a.posted_at || 0) - Date.parse(b.posted_at || 0));
    return {
      ...mapTopic(t, ou),
      description_html: t.Description?.Html || '',
      description: t.Description?.Text || '',
      must_post_first: Boolean(t.MustPostToParticipate),
      posts,
    };
  }

  // ---- to-do, planner, feedback --------------------------------------------
  const perCourse = async (courseList, fn) =>
    (
      await Promise.all(
        courseList.map((c) =>
          fn(c)
            .then((items) => items.map((i) => ({ ...i, course_id: c.id, context_name: c.name })))
            .catch(() => []) // a course with a broken tool is skipped, not fatal
        )
      )
    ).flat();

  // Work due soon that is neither graded nor turned in, across the given courses.
  async function todo(courseList, days = 14) {
    const now = Date.now();
    const due = (await perCourse(courseList, (c) => assignments(c.id))).filter((a) => {
      const t = a.due_at ? Date.parse(a.due_at) : NaN;
      return !a.grade && t >= now && t <= now + days * DAY;
    });
    const open = await Promise.all(
      due.map(async (a) => {
        if (a.kind === 'quiz') {
          const q = await quizAttempts(a.course_id, a.source_id).catch(() => ({ known: false }));
          return q.known && q.attempts_used > 0 ? null : a;
        }
        if (a.kind === 'discussion') return (await posted(a.course_id, a.forum_id, a.source_id).catch(() => false)) ? null : a;
        const s = await submission(a.course_id, a.source_id).catch(() => ({ submitted: false }));
        return s.submitted ? null : a;
      })
    );
    return open.filter(Boolean).sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  }

  // Every dated item between two instants, for the dashboard list view.
  async function planner(courseList, from, to) {
    return (await perCourse(courseList, (c) => assignments(c.id)))
      .filter((a) => a.due_at && Date.parse(a.due_at) >= from && Date.parse(a.due_at) <= to)
      .sort((a, b) => Date.parse(a.due_at) - Date.parse(b.due_at));
  }

  // Work due between two instants, each marked done or not: graded, handed in, attempted
  // (quizzes) or posted in (discussions). For the Tasks panel's progress and lists.
  async function tasks(courseList, from, to) {
    const due = await planner(courseList, from, to);
    return Promise.all(
      due.map(async (a) => {
        let done = Boolean(a.grade && a.grade.score > 0);
        if (!done && a.kind === 'assignment') done = (await submission(a.course_id, a.source_id).catch(() => ({ submitted: false }))).submitted;
        if (!done && a.kind === 'quiz') done = ((await quizAttempts(a.course_id, a.source_id).catch(() => ({ attempts_used: 0 }))).attempts_used || 0) > 0;
        if (!done && a.kind === 'discussion') done = await posted(a.course_id, a.forum_id, a.source_id).catch(() => false);
        return { ...a, done };
      })
    );
  }

  async function overdue() {
    const items = await soft(client.leObjects('overdueItems/myItems'), []);
    return items
      .map((i) => ({ id: i.ItemId, title: i.ItemName, course_id: i.OrgUnitId, due_at: i.DueDate }))
      .sort((a, b) => Date.parse(b.due_at) - Date.parse(a.due_at));
  }

  // Grade rows that changed recently. Types 1-4 are real items; 5-9 are computed rows and category totals.
  async function recentFeedback(courseList, days = 14) {
    const since = Date.now() - days * DAY;
    const rows = await perCourse(courseList, async (c) =>
      (await gradeValues(c.id))
        .filter((v) => (v.GradeObjectType == null || v.GradeObjectType <= 4) && v.LastModified && Date.parse(v.LastModified) >= since && v.PointsNumerator != null)
        .map((v) => ({ id: v.GradeObjectIdentifier, title: v.GradeObjectName, grade: toValue(v) }))
    );
    return rows.sort((a, b) => Date.parse(b.grade.graded_at) - Date.parse(a.grade.graded_at));
  }

  // ---- grades --------------------------------------------------------------
  // Names of the items Brightspace's own Grades page marks "Dropped!" (students see this
  // there, though the grade API does not say it). Kept in the saved cache like other page facts.
  const pageDrops = (ou) => client.keep(`drops:${ou}`, async () => {
    const html = await client.page(`/d2l/lms/grades/my_grades/main.d2l?ou=${encodeURIComponent(ou)}`).catch((e) => {
      if (e instanceof client.ApiError && e.status === 401) throw e;
      return '';
    });
    if (!html || typeof DOMParser === 'undefined') return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const names = new Set();
    for (const row of doc.querySelectorAll('tr')) {
      if (!/\bDropped!/.test(row.textContent || '')) continue;
      // The item's name is the row's first header or first cell with text.
      const cell = [...row.querySelectorAll('th, td')].find((c) => (c.textContent || '').replace(/\s+/g, ' ').trim() && !/Dropped!/.test(c.textContent));
      const name = cell ? cell.textContent.replace(/\s+/g, ' ').trim() : '';
      if (name) names.add(name.toLowerCase());
    }
    return [...names];
  });

  function markedDropped(v, system, c, dropNames, name) {
    // The Grades page's mark counts even for an item with no grade yet (Brightspace drops
    // empty items too, and they would otherwise come in as zeros).
    if (dropNames && name && dropNames.has(String(name).trim().toLowerCase())) return true;
    if (!v) return false;
    if (v.IsDropped === true || v.Dropped === true) return true;
    const rule = (c?.NumberOfLowestToDrop || 0) + (c?.NumberOfHighestToDrop || 0) > 0;
    return Boolean(rule && system === 'Weighted' && v.PointsNumerator != null && v.WeightedDenominator === 0);
  }

  const newGroup = (key, c) => ({
    id: key,
    name: c ? c.Name : null,
    weight: c ? c.Weight : null,
    drop_lowest: c?.NumberOfLowestToDrop || 0,
    drop_highest: c?.NumberOfHighestToDrop || 0,
    value: c ? toValue(c.__value) || null : null,
    items: [],
  });

  async function grades(ou) {
    const [items, categories, values, final, setup, dropList] = await Promise.all([
      soft(client.le(`${ou}/grades/`), []),
      soft(client.le(`${ou}/grades/categories/`), []),
      gradeValues(ou),
      soft(client.le(`${ou}/grades/final/values/myGradeValue`), null),
      soft(client.le(`${ou}/grades/setup/`), null),
      pageDrops(ou).catch(() => []),
    ]);
    const dropNames = new Set(dropList);
    const byId = new Map(values.map((v) => [String(v.GradeObjectIdentifier), v]));
    // Each category carries its own released total (its subtotal row), for newGroup.
    const categoryById = new Map(categories.map((c) => [c.Id, { ...c, __value: byId.get(String(c.Id)) }]));
    // Some courses leave MaxPoints off the grade-item list but give it in each category's
    // own list of items; fill it in from there.
    const fromCategories = new Map(categories.flatMap((c) => (c.Grades || []).map((g) => [g.Id, g])));
    const itemCount = new Map();
    for (const item of items) if (!item.IsHidden) itemCount.set(item.CategoryId, (itemCount.get(item.CategoryId) || 0) + 1);
    const groups = new Map();
    for (const item of items) {
      if (item.IsHidden) continue;
      const key = categoryById.has(item.CategoryId) ? item.CategoryId : 0;
      if (!groups.has(key)) {
        const c = categoryById.get(key);
        groups.set(key, newGroup(key, categoryById.get(key)));
      }
      const full = fromCategories.get(item.Id) || {};
      const c = categoryById.get(key);
      groups.get(key).items.push({
        id: item.Id,
        name: item.Name,
        type: item.GradeType || full.GradeType,
        points_possible: item.MaxPoints ?? full.MaxPoints ?? null,
        weight: item.Weight ?? full.Weight ?? null,
        group_weight: c?.Weight ?? null,
        group_count: itemCount.get(item.CategoryId) || 1,
        // How the category's weight is split among its items: 0 by hand (each item's own
        // weight), 1 by points, 2 equally (Brightspace's WeightDistributionType).
        distribution: c?.WeightDistributionType ?? null,
        bonus: Boolean(item.IsBonus ?? full.IsBonus),
        // "Not counted": the instructor set Exclude from final grade on the item, or on its category.
        excluded: Boolean(item.ExcludeFromFinalGradeCalculation ?? full.ExcludeFromFinalGradeCalculation) || Boolean(c?.ExcludeFromFinalGrade),
        // Dropped by Brightspace itself: a dropped flag if one is sent, or, in a weighted
        // gradebook with a drop rule, a graded item Brightspace gives no share of the grade.
        marked_dropped: markedDropped(byId.get(String(item.Id)), setup?.GradingSystem, c, dropNames, item.Name),
        value: toValue(byId.get(String(item.Id))) || null,
      });
    }
    // Points in each category, for categories that split their weight by points; and the usual
    // share of an item in it, for items Brightspace reports with no share (ones it dropped),
    // so they stay in play when What-If works the category out again.
    for (const g of groups.values()) {
      const total = g.items.reduce((s, i) => s + (i.points_possible > 0 && !i.bonus ? i.points_possible : 0), 0);
      const shares = g.items.map((i) => i.value?.weighted_possible).filter((w) => w > 0);
      const peer = shares.length ? shares.reduce((s, w) => s + w, 0) / shares.length : null;
      for (const i of g.items) {
        i.group_points = total;
        i.peer_wp = peer;
      }
    }
    // A category whose items are all hidden from students but whose total is released (say,
    // "Projects" with only its subtotal visible): shown, with that total as its one line, so
    // it is seen, counted and can be tried in What-If.
    for (const c of categoryById.values()) {
      if (groups.has(c.Id)) continue;
      const v = toValue(c.__value);
      if (!v || v.score == null) continue;
      const g = newGroup(c.Id, c);
      g.items.push({
        id: `category-${c.Id}`,
        name: `${c.Name} (group grade)`,
        total: true,
        type: 'Numeric',
        points_possible: v.points_possible,
        weight: null,
        group_weight: c.Weight ?? null,
        group_count: 1,
        distribution: null,
        group_points: v.points_possible,
        bonus: false,
        excluded: Boolean(c.ExcludeFromFinalGrade),
        value: v,
      });
      groups.set(c.Id, g);
    }
    // null_is_zero: the course counts an empty grade as 0 (Brightspace's "treat ungraded as 0").
    const result = { system: setup?.GradingSystem || null, null_is_zero: Boolean(setup?.IsNullGradeZero), final: toValue(final) || null, estimate: null, groups: [...groups.values()] };
    result.estimate = estimate(result);
    return result;
  }

  // An item's points and its share of the final grade, or null when it cannot count.
  // Weighted gradebooks report the share on graded items; for ungraded ones it comes from
  // the item's weight within its category times the category's weight.
  // Grade types with points: plain numbers, and drop-down ("select box") grades.
  const POINTS_TYPES = new Set(['Numeric', 'SelectBox']);

  // Why an item cannot take part in an estimate or a What-If score, or null when it can.
  // g.count_excluded: the student chose to count items Brightspace marks "not counted".
  function whyNot(g, i) {
    if (i.excluded && !g.count_excluded) return 'Brightspace marks this “not counted”. Tick “Count items marked not counted” to include it.';
    if (i.type && !POINTS_TYPES.has(i.type)) return i.type === 'PassFail' ? 'Pass/fail item' : i.type === 'Text' ? 'Comment-only item' : `${i.type} item (worked out by Brightspace)`;
    const pp = i.value?.points_possible ?? i.points_possible;
    if (!(pp > 0)) return 'Brightspace does not say what this is out of';
    if (g.system !== 'Points' && g.system !== 'Weighted') return 'This gradebook is not points or weighted';
    if (g.system === 'Weighted' && !share(g, i)) return 'Brightspace does not give this item a weight';
    return null;
  }

  function share(g, i) {
    if ((i.excluded && !g.count_excluded) || (i.type && !POINTS_TYPES.has(i.type))) return null;
    const pp = i.value?.points_possible ?? i.points_possible;
    if (!(pp > 0)) return null;
    if (g.system === 'Points') return { pp, wp: pp };
    if (g.system !== 'Weighted') return null;
    // Brightspace's own figure for a graded item; otherwise from the category's weight, split
    // the way the category says: by the item's own weight, by points, or equally.
    let wp = i.value?.weighted_possible;
    if (!(wp > 0) && i.weight > 0 && i.distribution !== 1 && i.distribution !== 2) wp = i.group_weight != null ? (i.group_weight * i.weight) / 100 : i.weight;
    if (!(wp > 0) && i.group_weight > 0 && i.distribution === 1 && i.group_points > 0) wp = (i.group_weight * pp) / i.group_points;
    if (!(wp > 0) && i.group_weight > 0) wp = i.group_weight / (i.group_count || 1);
    // Still nothing (an item Brightspace dropped, reported with no share): the share its
    // category's other items have.
    if (!(wp > 0) && i.peer_wp > 0) wp = i.peer_wp;
    return wp > 0 ? { pp, wp } : null;
  }

  // Can this item take part in an estimate or a What-If score?
  const estimable = (g, i) => share(g, i) != null;

  // Unofficial running total from real grade items only (category subtotals and calculated
  // rows are never added in, which would double-count). `overrides` maps item id to a
  // hypothetical score. Each category's drop-lowest and drop-highest rules are applied
  // by percentage, as Brightspace does. Points: plain sum. Weighted: each item's share.
  // `allItems`: Canvas's unticked "Calculate based only on graded assignments", where every
  // ungraded item counts as zero.
  function estimate(g, overrides = new Map(), opts = {}) {
    const t = tally(g, overrides, opts);
    return t.possible > 0 ? { score: t.score, points_possible: t.possible } : null;
  }

  // Ids of the items a category's drop rules leave out, for the same inputs as estimate().
  const dropped = (g, overrides = new Map(), opts = {}) => tally(g, overrides, opts).dropped;

  function tally(g, overrides, { allItems = false } = {}) {
    let score = 0;
    let possible = 0;
    const out = new Set(); // every dropped item
    const marked = new Set(); // the ones Brightspace itself marked as dropped
    // Each category's own result: { score, possible } in the gradebook's units (weight in a
    // weighted one), its kept points, and whether it was worked out here (not Brightspace's).
    const perGroup = new Map();
    for (const group of g.groups) {
      // Brightspace's own result for a category (its weight achieved) already includes what
      // it works out but does not show students: formulas, caps, drops. While nothing in the
      // category is changed here, that figure is used as it is.
      // Counting blanks as 0 only changes a category that has a blank in it.
      const touched = group.items.some((i) => overrides.has(i.id) || (allItems && !i.bonus && !i.total && (!i.value || i.value.score == null) && share(g, i)));
      const gv = group.value;
      const countable = group.items.some((i) => !i.excluded || g.count_excluded);
      // A weighted category counts for its whole weight: its grade (kept score over kept share)
      // times the weight, as Brightspace works it out, however many of its items are graded.
      const add = (gs, gp, computed, points, pointsPossible) => {
        if (!(gp > 0)) return;
        const norm = g.system === 'Weighted' && group.name && group.weight > 0 ? group.weight / gp : 1;
        score += gs * norm;
        possible += gp * norm;
        perGroup.set(group, { score: gs, possible: gp, points, points_possible: pointsPossible, computed });
      };
      if (!touched && countable && group.name && g.system === 'Weighted' && gv && gv.weighted_score != null && gv.weighted_possible > 0) {
        add(gv.weighted_score, gv.weighted_possible, false, gv.score, gv.points_possible);
        for (const i of group.items) if (i.marked_dropped) { out.add(i.id); marked.add(i.id); }
        continue;
      }
      let counted = [];
      for (const i of group.items) {
        const sh = share(g, i);
        if (!sh) continue;
        const override = overrides.get(i.id);
        let s = override != null ? override : i.value ? i.value.score : null;
        if (s == null && allItems && !i.bonus) s = 0;
        if (s == null) continue;
        // An unchanged, graded item: Brightspace's weight achieved for it, which can differ from
        // score/points (a formula or cap it applies on its side).
        const ws = override == null && g.system === 'Weighted' && i.value && i.value.weighted_score != null && i.value.weighted_possible > 0 ? i.value.weighted_score : null;
        counted.push({ ...sh, s, ws, bonus: i.bonus, id: i.id });
      }
      const drops = (group.drop_lowest || 0) + (group.drop_highest || 0);
      const regular = counted.filter((c) => !c.bonus).sort((a, b) => a.s / a.pp - b.s / b.pp);
      // Empty items Brightspace's drop rule can still pick (it drops them, lowest of all). They
      // are not counted, so dropping one moves no weight anywhere.
      const empties = drops > 0
        ? group.items.filter((i) => !i.bonus && !i.total && !counted.some((c) => c.id === i.id) && !overrides.has(i.id) && (!i.value || i.value.score == null) && share(g, i)).map((i) => ({ id: i.id, s: 0, pp: 1, empty: true }))
        : [];
      const noScale = new Set(empties.map((e) => e.id)); // drops that move no weight to the rest
      // Brightspace's own marks win while the category's scores are the real ones; once a
      // What-If score (or counting ungraded work as 0) changes them, the rule is worked out here.
      const brightspaceSays = group.items.filter((i) => i.marked_dropped).map((i) => i.id);
      if (brightspaceSays.length) {
        // Brightspace's own drops stand (it may drop for reasons beyond a lowest-N rule), except
        // items the student changed in What-If. Each of those comes back into play, and the
        // lowest score still in play is dropped in its place, so the number dropped stays the
        // same. A rule asking for more drops than Brightspace marked drops the extra lowest.
        const keep = brightspaceSays.filter((id) => !overrides.has(id));
        for (const id of keep) {
          out.add(id);
          marked.add(id);
        }
        const freed = brightspaceSays.length - keep.length;
        const extra = Math.max(0, (group.drop_lowest || 0) - brightspaceSays.length);
        // Lowest first, empty items before any score; at least one real score stays in.
        const inPlay = [...empties, ...regular].filter((c) => !out.has(c.id));
        const room = Math.max(0, inPlay.length - (regular.some((c) => !out.has(c.id)) ? 1 : 0));
        // Brightspace's shares for the kept items already make up the category's whole weight,
        // so none of these drops moves weight to the rest.
        for (const c of inPlay.slice(0, Math.min(freed + extra, room))) {
          out.add(c.id);
          noScale.add(c.id);
        }
        counted = counted.filter((c) => !out.has(c.id));
      } else if (drops > 0 && regular.length + empties.length > drops) {
        const all = [...empties, ...regular];
        const kept = all.slice(group.drop_lowest || 0, all.length - (group.drop_highest || 0));
        for (const c of all) if (!kept.includes(c)) out.add(c.id);
        counted = [...kept.filter((c) => !c.empty), ...counted.filter((c) => c.bonus)];
      }
      // Weighted gradebooks: the share of a dropped score goes to the scores the category keeps
      // (as Brightspace does), so the category still counts for as much as before the drop
      // instead of shrinking. Points gradebooks just leave the dropped points out.
      const keptShare = counted.filter((c) => !c.bonus).reduce((s, c) => s + c.wp, 0);
      // A dropped item's share: Brightspace reports 0 for ones it dropped, so use the item's
      // weight from the category instead (as share() would without Brightspace's figure).
      const shareOf = (i) => {
        const known = regular.find((c) => c.id === i.id)?.wp;
        return known > 0 ? known : share(g, { ...i, value: i.value ? { ...i.value, weighted_possible: null } : null })?.wp || 0;
      };
      const droppedShare = group.items.filter((i) => out.has(i.id)).reduce((s, i) => s + shareOf(i), 0);
      // Only drops worked out from the rule move weight to the kept scores; Brightspace's own
      // drops are already left out of its figures, so its category share does not include them.
      const ruleDropShare = group.items.filter((i) => out.has(i.id) && !marked.has(i.id) && !noScale.has(i.id)).reduce((s, i) => s + shareOf(i), 0);
      const scale = g.system === 'Weighted' && keptShare > 0 && ruleDropShare > 0 && droppedShare > 0 ? (keptShare + ruleDropShare) / keptShare : 1;
      let gs = 0, gp = 0, pts = 0, ptsP = 0;
      for (const c of counted) {
        gs += (c.ws != null ? c.ws : (c.s / c.pp) * c.wp) * scale;
        pts += c.s;
        if (!c.bonus) { gp += c.wp * scale; ptsP += c.pp; }
      }
      add(gs, gp, true, pts, ptsP);
    }
    return { score, possible, dropped: out, marked, groups: perGroup };
  }

  // Dropped items with where the decision came from: { dropped: Set, marked: Set (Brightspace's) }.
  const dropInfo = (g, overrides = new Map(), opts = {}) => {
    const t = tally(g, overrides, opts);
    return { dropped: t.dropped, marked: t.marked };
  };

  // Each category's result for the same inputs as estimate(): Map(group → { score, possible,
  // points, points_possible, computed }).
  const groupResults = (g, overrides = new Map(), opts = {}) => tally(g, overrides, opts).groups;

  // A category's drop rule in words, e.g. "lowest 2 dropped".
  const dropRule = (group) => [group.drop_lowest ? `lowest ${group.drop_lowest} dropped` : null, group.drop_highest ? `highest ${group.drop_highest} dropped` : null].filter(Boolean).join(', ');

  // One line per course for the all-courses Grades page.
  async function courseTotals(courseList) {
    return Promise.all(
      courseList.map((c) =>
        grades(c.id)
          .then((g) => ({ course_id: c.id, final: g.final, estimate: g.estimate }))
          .catch(() => ({ course_id: c.id, final: null, estimate: null }))
      )
    );
  }

  // ---- announcements -------------------------------------------------------
  async function announcements(ou) {
    const [items, base] = await Promise.all([soft(client.le(`${ou}/news/`), []).then(list), client.lePath(`${ou}/news`)]);
    const now = Date.now();
    return items
      .filter(
        (n) =>
          !n.IsHidden &&
          n.IsPublished !== false &&
          (!n.StartDate || Date.parse(n.StartDate) <= now) &&
          (!n.EndDate || Date.parse(n.EndDate) > now)
      )
      .map((n) => ({
        id: n.Id,
        title: n.Title,
        message_html: n.Body?.Html || '', // untrusted: the interface sanitises before showing
        message: n.Body?.Text || '',
        posted_at: n.StartDate || n.CreatedDate || null,
        pinned: Boolean(n.IsPinned),
        attachments: (n.Attachments || []).map((f) => ({ name: f.FileName, size: f.Size, url: `${base}/${n.Id}/attachments/${f.FileId}` })),
      }))
      .sort((a, b) => b.pinned - a.pinned || Date.parse(b.posted_at || 0) - Date.parse(a.posted_at || 0));
  }

  async function recentAnnouncements(courseList, days = 7) {
    const since = Date.now() - days * DAY;
    return (await perCourse(courseList, (c) => announcements(c.id)))
      .filter((a) => a.posted_at && Date.parse(a.posted_at) >= since)
      .sort((a, b) => Date.parse(b.posted_at) - Date.parse(a.posted_at));
  }

  // ---- content -------------------------------------------------------------
  function topicType(t) {
    const url = t.Url || '';
    if (/type=lti/i.test(url)) return 'External tool';
    if (/type=dropbox/i.test(url) || /\/dropbox\//i.test(url)) return 'Assignment';
    if (/type=quiz/i.test(url) || /\/quizzing\//i.test(url)) return 'Quiz';
    if (/type=discuss/i.test(url) || /\/discussions\//i.test(url)) return 'Discussion';
    if (t.TypeIdentifier === 'Link') return 'Link';
    if (t.TypeIdentifier === 'File') return 'File';
    return t.TypeIdentifier || 'Item';
  }

  const MODULE_TEXT = 1e9; // ids of module-text items: this plus the module id

  // Content tree flattened to a list of modules; `depth` keeps the nesting for indentation.
  async function modules(ou) {
    const [toc, topicBase] = await Promise.all([soft(client.le(`${ou}/content/toc`), { Modules: [] }), client.lePath(`${ou}/content/topics`)]);
    const out = [];
    const walk = (mods, depth) => {
      for (const m of mods || []) {
        if (m.IsHidden) continue;
        // A module's own text (and images), when it has any, is its first item, under the
        // module's name. Its id is set apart from topic ids.
        const html = m.Description?.Html || '';
        const text = m.Description?.Text || '';
        const hasText = Boolean(text.trim() || /<img\b/i.test(html));
        const overview = hasText ? [{ id: MODULE_TEXT + m.ModuleId, title: m.Title, type: 'Module overview', unread: false, locked: Boolean(m.IsLocked), description_html: html, description: text, url: '', html_url: `/d2l/le/content/${ou}/Home?itemIdentifier=D2L.LE.Content.ContentObject.ModuleCO-${m.ModuleId}` }] : [];
        out.push({
          id: m.ModuleId,
          name: m.Title,
          depth,
          locked: Boolean(m.IsLocked),
          items: [...overview, ...(m.Topics || [])
            .filter((t) => !t.IsHidden)
            .map((t) => ({
              id: t.TopicId,
              title: t.Title,
              type: topicType(t),
              unread: Boolean(t.Unread),
              locked: Boolean(t.IsLocked),
              updated_at: t.LastModifiedDate || null,
              url: t.Url || '', // a link's address, a tool's launch address, or a file's path
              file_url: `${topicBase}/${t.TopicId}/file?stream=true`, // the file itself, shown inline
              html_url: `/d2l/le/content/${ou}/viewContent/${t.TopicId}/View`,
            }))],
        });
        walk(m.Modules, depth + 1);
      }
    };
    walk(toc.Modules, 0);
    return out;
  }

  const itemsOfType = async (ou, type) => {
    const seen = new Map();
    for (const m of await modules(ou)) {
      for (const i of m.items) if (i.type === type && !seen.has(`${i.title}`)) seen.set(i.title, { ...i, module: m.name });
    }
    return [...seen.values()];
  };

  // Gradescope, publisher homework sites and the like: found as LTI links in Content.
  const externalTools = (ou) => itemsOfType(ou, 'External tool');
  const files = (ou) => itemsOfType(ou, 'File');

  // Links on the course's own Brightspace home page (its navigation bar and menus), for
  // tools the API does not list, such as Simple Syllabus or the notification settings.
  // Only same-site /d2l/ addresses are kept.
  // Each link also carries `group`: the name of the navigation-bar menu it sits in (such as
  // "Course Tools"), taken from the nearest enclosing element that has a text or label.
  // Kept in the saved cache, so course pages fill these in at once on the next visit.
  const homeLinks = (ou) => client.keep(`homelinks:${ou}`, () => readHomeLinks(ou));
  async function readHomeLinks(ou) {
    const html = await client.page(`/d2l/home/${encodeURIComponent(ou)}`).catch((e) => {
      if (e instanceof client.ApiError && e.status === 401) throw e;
      return '';
    });
    if (!html || typeof DOMParser === 'undefined') return [];
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const label = (el) => (el.getAttribute('text') || el.getAttribute('aria-label') || el.getAttribute('label') || '').replace(/\s+/g, ' ').trim();
    const groupOf = (el) => {
      for (let p = el.parentElement; p && p !== doc.body; p = p.parentElement) {
        if (/dropdown|menu/i.test(p.tagName) || p.getAttribute('role') === 'menu') {
          const own = label(p);
          if (own) return own;
          // A dropdown's name is usually on its opener, the element just before the menu.
          const opener = p.closest('[class*="dropdown" i], d2l-dropdown, d2l-navigation-dropdown-button-icon');
          if (opener && label(opener)) return label(opener);
        }
      }
      return null;
    };
    const out = [];
    for (const el of doc.querySelectorAll('[href]')) {
      const href = el.getAttribute('href') || '';
      const text = (el.getAttribute('text') || el.textContent || el.getAttribute('title') || '').replace(/\s+/g, ' ').trim();
      if (text && /^\/d2l\//.test(href)) out.push({ text, href, group: groupOf(el) });
    }
    return out;
  }

  // The course's syllabus tool (Purdue uses Simple Syllabus): a Content link or tool named
  // "syllabus" first, then the course navigation bar.
  async function syllabusLink(ou) {
    const items = (await modules(ou)).flatMap((m) => m.items).filter((i) => /syllabus/i.test(i.title) && (i.type === 'External tool' || i.type === 'Link'));
    if (items.length) return { title: items[0].title, url: items[0].url || items[0].html_url };
    const l = (await homeLinks(ou)).find((x) => /syllabus/i.test(x.text));
    return l ? { title: l.text, url: l.href } : null;
  }

  // The course's own tools from Brightspace's navigation bar (Course Tools, Class Progress,
  // and whatever else the school adds), less the pages the wrapper already has and links
  // that lead away from this course (other courses, the personal menu).
  const COVERED = /^\/d2l\/(home\b|lp\/|api\/|logout|le\/content\/|le\/lessons\/|lms\/dropbox\/|lms\/quizzing\/|le\/\d+\/discussions\/|lms\/grades\/my_grades\/|lms\/classlist\/|lms\/news\/|lms\/email\/|Notifications\/)/i;
  // Tools whose name is a page the wrapper already has, whatever address the school gives it.
  const COVERED_NAMES = /^(content|course home|home|grades?|my grades|assignments?|dropbox|quizzes|discussions?|classlist|class list|announcements?|news|calendar|email|syllabus)$/i;
  async function courseTools(ou) {
    const seen = new Set();
    const out = [];
    for (const l of await homeLinks(ou)) {
      if (COVERED.test(l.href) || COVERED_NAMES.test(l.text) || l.text.length > 60) continue;
      const other = l.href.match(/[?&]ou=(\d+)/);
      if (other && other[1] !== String(ou)) continue; // a link into another course
      const key = l.href.replace(/#.*$/, '');
      if (seen.has(key) || seen.has(`t:${l.text.toLowerCase()}`)) continue;
      seen.add(key);
      seen.add(`t:${l.text.toLowerCase()}`);
      out.push({ title: l.text, url: key, group: l.group || null });
    }
    return out;
  }

  // Brightspace's notification settings, found by its link (its address differs between schools).
  async function notificationsLink(ou) {
    const l = (await homeLinks(ou)).find((x) => /notification/i.test(x.text));
    return l ? l.href : null;
  }

  // The course overview, which is where Brightspace keeps a syllabus description.
  async function syllabus(ou) {
    const o = await soft(client.le(`${ou}/overview`), null);
    if (!o) return null;
    return { html: o.Description?.Html || '', text: o.Description?.Text || '', has_attachment: Boolean(o.HasAttachment) };
  }

  // The student's groups. Group memberships come from the enrolment list; each course's
  // group categories (where Brightspace lets a student read them) say which course a
  // group belongs to, its category and its members.
  async function groups(courseList) {
    const mine = (await client.lpBookmarked('enrollments/myenrollments/')).filter((e) => e.OrgUnit?.Type?.Code === 'Group');
    const ids = new Set(mine.map((e) => String(e.OrgUnit.Id)));
    const found = new Map();
    await Promise.all(
      courseList.map(async (c) => {
        const cats = list(await soft(client.lp(`${c.id}/groupcategories/`), []).catch(() => []));
        await Promise.all(
          cats.map(async (cat) => {
            const gs = list(await soft(client.lp(`${c.id}/groupcategories/${cat.GroupCategoryId}/groups/`), []).catch(() => []));
            for (const g of gs) {
              if (!ids.has(String(g.GroupId))) continue;
              found.set(String(g.GroupId), { course_id: c.id, category: cat.Name || '', member_ids: (g.Enrollments || []).map(String), description: g.Description?.Text || '' });
            }
          })
        );
      })
    );
    return mine
      .map((e) => {
        const f = found.get(String(e.OrgUnit.Id)) || {};
        return { id: e.OrgUnit.Id, name: e.OrgUnit.Name, code: e.OrgUnit.Code || '', course_id: f.course_id ?? null, category: f.category || '', member_ids: f.member_ids || null, description: f.description || '' };
      })
      .sort((a, b) => (a.course_id ?? Infinity) - (b.course_id ?? Infinity) || a.name.localeCompare(b.name));
  }

  async function people(ou) {
    return list(await soft(client.le(`${ou}/classlist/`), []))
      .map((p) => ({ id: p.Identifier, name: p.DisplayName || [p.FirstName, p.LastName].filter(Boolean).join(' '), role: p.ClasslistRoleDisplayName || '' }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  // ---- calendar ------------------------------------------------------------
  async function calendar(courseIds, from, to) {
    if (!courseIds.length) return [];
    const range = `startDateTime=${encodeURIComponent(new Date(from).toISOString())}&endDateTime=${encodeURIComponent(new Date(to).toISOString())}`;
    const events = await client.leObjects(`calendar/events/myEvents/?orgUnitIdsCSV=${courseIds.join(',')}&${range}`);
    // An item with both an availability date and a due date has an event for each; keep
    // the latest one (the due date), as Canvas shows one entry per assignment.
    const byEntity = new Map();
    const loose = [];
    for (const e of events) {
      const a = e.AssociatedEntity;
      if (!a || a.AssociatedEntityId == null) { loose.push(e); continue; }
      const k = `${e.OrgUnitId}:${a.AssociatedEntityType}:${a.AssociatedEntityId}`;
      const end = (x) => Date.parse(x.EndDateTime || x.StartDateTime || 0);
      if (!byEntity.has(k) || end(e) > end(byEntity.get(k))) byEntity.set(k, e);
    }
    return [...loose, ...byEntity.values()]
      .map((e) => ({
        id: e.CalendarEventId,
        title: e.Title,
        course_id: e.OrgUnitId,
        context_name: e.OrgUnitName,
        start_at: e.StartDateTime || e.EndDateTime,
        end_at: e.EndDateTime || e.StartDateTime,
        all_day: Boolean(e.IsAllDayEvent),
        description: e.Description || '', // may be HTML; sanitised before it is shown
        location: e.LocationName || '',
        // Events tied to an assignment, quiz or topic open that item; the rest (lectures,
        // exams, office hours) open a detail panel in the calendar.
        associated: Boolean(e.IsAssociatedWithEntity && e.AssociatedEntity?.Link),
        html_url: e.AssociatedEntity?.Link || e.CalendarEventViewUrl || null,
      }))
      .filter((e) => e.start_at)
      .sort((a, b) => Date.parse(a.start_at) - Date.parse(b.start_at));
  }

  return {
    courses, orgId, me, updates,
    assignments, assignmentGroups, assignment, submission, canSubmit, submit, quiz, quizAttempts, parseQuizSummary, discussions, discussion, post,
    todo, planner, tasks, overdue, recentFeedback,
    grades, estimate, dropped, dropInfo, groupResults, dropRule, estimable, whyNot, courseTotals,
    announcements, recentAnnouncements,
    modules, externalTools, files, syllabus, syllabusLink, notificationsLink, homeLinks, courseTools, people, groups,
    calendar,
  };
})();
