import { defineType, defineField, defineArrayMember } from "sanity";

export const post = defineType({
  name: "post",
  title: "Post",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: r => r.required() }),
    defineField({
      name: "slug", type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: r => r.required(),
    }),
    defineField({
      name: "description", type: "text", rows: 2,
      description: "One sentence — used as meta description, OG description, and card summary.",
      validation: r => r.required().max(200),
    }),
    defineField({
      name: "tldr", type: "text", rows: 3,
      description: "AIO/GEO — surfaces to AI summarizers as <meta tldr> and as a blockquote at post top.",
    }),
    defineField({ name: "pubDate", type: "datetime", validation: r => r.required() }),
    defineField({ name: "updatedDate", type: "datetime" }),
    defineField({
      name: "author", type: "reference", to: [{ type: "author" }],
    }),
    defineField({
      name: "category", type: "string",
      options: {
        list: [
          { title: "AI Agents", value: "AI Agents" },
          { title: "Engineering", value: "Engineering" },
          { title: "Cloudflare", value: "Cloudflare" },
          { title: "MSP", value: "MSP" },
          { title: "Meta", value: "Meta" },
          { title: "Philosophy", value: "Philosophy" },
        ],
      },
      initialValue: "Engineering",
    }),
    defineField({
      name: "tags", type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    defineField({
      name: "keywords", type: "array",
      description: "SEO keywords — becomes <meta keywords>.",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    defineField({
      name: "heroImage", type: "image",
      options: { hotspot: true },
    }),
    defineField({
      name: "body", type: "array",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "H2", value: "h2" },
            { title: "H3", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Emphasis", value: "em" },
              { title: "Code", value: "code" },
            ],
            annotations: [
              {
                name: "link", type: "object", title: "External link",
                fields: [
                  { name: "href", type: "url", title: "URL" },
                  { name: "blank", type: "boolean", title: "Open in new tab" },
                ],
              },
            ],
          },
        }),
        defineArrayMember({ type: "image", options: { hotspot: true } }),
        defineArrayMember({
          name: "codeBlock", type: "object", title: "Code Block",
          fields: [
            { name: "language", type: "string", title: "Language" },
            { name: "code", type: "text", title: "Code" },
            { name: "filename", type: "string", title: "Filename (optional)" },
          ],
          preview: {
            select: { title: "filename", subtitle: "language" },
            prepare: ({ title, subtitle }) => ({
              title: title || "Code block",
              subtitle: subtitle || "code",
            }),
          },
        }),
      ],
    }),
    defineField({ name: "draft", type: "boolean", initialValue: true }),
  ],
  preview: {
    select: { title: "title", subtitle: "pubDate", media: "heroImage" },
    prepare: ({ title, subtitle, media }) => ({
      title,
      subtitle: subtitle ? new Date(subtitle).toDateString() : "no date",
      media,
    }),
  },
  orderings: [
    { title: "Newest", name: "pubDateDesc", by: [{ field: "pubDate", direction: "desc" }] },
    { title: "Oldest", name: "pubDateAsc", by: [{ field: "pubDate", direction: "asc" }] },
  ],
});

export const page = defineType({
  name: "page",
  title: "Page",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: r => r.required() }),
    defineField({
      name: "slug", type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: r => r.required(),
    }),
    defineField({ name: "description", type: "text", rows: 2 }),
    defineField({ name: "updatedDate", type: "datetime" }),
    defineField({
      name: "body", type: "array",
      of: [defineArrayMember({ type: "block" }), defineArrayMember({ type: "image" })],
    }),
    defineField({ name: "draft", type: "boolean", initialValue: false }),
  ],
});

export const author = defineType({
  name: "author",
  title: "Author",
  type: "document",
  fields: [
    defineField({ name: "name", type: "string", validation: r => r.required() }),
    defineField({
      name: "slug", type: "slug",
      options: { source: "name", maxLength: 96 },
    }),
    defineField({ name: "role", type: "string" }),
    defineField({ name: "bio", type: "text", rows: 3 }),
    defineField({ name: "avatar", type: "image", options: { hotspot: true } }),
    defineField({
      name: "socials", type: "object",
      fields: [
        { name: "github", type: "url" },
        { name: "twitter", type: "url" },
        { name: "website", type: "url" },
      ],
    }),
  ],
});

export const project = defineType({
  name: "project",
  title: "Project",
  type: "document",
  fields: [
    defineField({ name: "name", type: "string", validation: r => r.required() }),
    defineField({ name: "slug", type: "slug", options: { source: "name" } }),
    defineField({ name: "tagline", type: "text", rows: 2 }),
    defineField({
      name: "status", type: "string",
      options: { list: ["Active", "Live", "Alpha", "Paused", "Archived"] },
      initialValue: "Active",
    }),
    defineField({ name: "url", type: "url" }),
    defineField({
      name: "stack", type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    defineField({ name: "order", type: "number", initialValue: 100 }),
  ],
  orderings: [
    { title: "Order", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
  ],
});

// ─── PRODUCTS ──────────────────────────────────────────────
export const product = defineType({
  name: "product",
  title: "Product",
  type: "document",
  fields: [
    defineField({ name: "name", type: "string", validation: r => r.required() }),
    defineField({
      name: "slug", type: "slug",
      options: { source: "name", maxLength: 96 },
      validation: r => r.required(),
    }),
    defineField({
      name: "kind", type: "string",
      options: { list: ["book", "guide", "template", "playbook", "toolkit"] },
      initialValue: "playbook",
      validation: r => r.required(),
    }),
    defineField({
      name: "status", type: "string",
      options: { list: ["available", "preorder", "waitlist", "draft"] },
      initialValue: "draft",
    }),
    defineField({ name: "tagline", type: "text", rows: 2, validation: r => r.required() }),
    defineField({ name: "description", type: "text", rows: 4 }),
    defineField({ name: "price", type: "string", description: "Display string, e.g. '$29' or 'Free'." }),
    defineField({ name: "buyUrl", type: "url", description: "Checkout URL (Lemon Squeezy / Gumroad / etc.)." }),
    defineField({ name: "readUrl", type: "url", description: "Free-to-read URL." }),
    defineField({ name: "audience", type: "text", rows: 2, description: "Who this is for." }),
    defineField({
      name: "topics", type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    defineField({ name: "chapters", type: "number" }),
    defineField({ name: "pages", type: "number" }),
    defineField({ name: "cover", type: "image", options: { hotspot: true } }),
    defineField({ name: "order", type: "number", initialValue: 100 }),
    // For products that ARE a book — link them so the /products page and /books share
    defineField({ name: "bookRef", type: "reference", to: [{ type: "book" }], description: "If this product is a book, link it here so we can share metadata." }),
  ],
  orderings: [
    { title: "Order", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
  ],
});

// ─── COURSES ──────────────────────────────────────────────
export const course = defineType({
  name: "course",
  title: "Course",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: r => r.required() }),
    defineField({
      name: "slug", type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: r => r.required(),
    }),
    defineField({
      name: "status", type: "string",
      options: { list: ["available", "cohort-open", "waitlist", "coming-soon"] },
      initialValue: "coming-soon",
    }),
    defineField({
      name: "format", type: "string",
      options: { list: ["self-paced", "cohort", "workshop"] },
      initialValue: "self-paced",
    }),
    defineField({ name: "tagline", type: "text", rows: 2, validation: r => r.required() }),
    defineField({ name: "description", type: "text", rows: 5 }),
    defineField({ name: "duration", type: "string" }),
    defineField({ name: "price", type: "string" }),
    defineField({ name: "buyUrl", type: "url" }),
    defineField({ name: "waitlistUrl", type: "url" }),
    defineField({
      name: "outcomes", type: "array",
      of: [defineArrayMember({ type: "string" })],
      description: "3-5 concrete outcomes.",
    }),
    defineField({ name: "modules", type: "number" }),
    defineField({ name: "hours", type: "number" }),
    defineField({ name: "prereqs", type: "text", rows: 2 }),
    defineField({ name: "audience", type: "text", rows: 2 }),
    defineField({ name: "cover", type: "image", options: { hotspot: true } }),
    defineField({ name: "order", type: "number", initialValue: 100 }),
  ],
  orderings: [
    { title: "Order", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
  ],
});

// ─── BOOKS ────────────────────────────────────────────────
// A `book` is the shell (title, cover, subtitle, description, buy links).
// Chapters live as separate `chapter` documents referencing the book,
// so long-form content stays queryable and Studio can edit each chapter
// independently. Reading order controlled by `order` on each chapter.
export const book = defineType({
  name: "book",
  title: "Book",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: r => r.required() }),
    defineField({ name: "subtitle", type: "string" }),
    defineField({
      name: "slug", type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: r => r.required(),
    }),
    defineField({ name: "description", type: "text", rows: 3, validation: r => r.required() }),
    defineField({ name: "tagline", type: "string" }),
    defineField({ name: "author", type: "reference", to: [{ type: "author" }] }),
    defineField({
      name: "status", type: "string",
      options: { list: ["draft", "in-progress", "published", "archived"] },
      initialValue: "in-progress",
    }),
    defineField({ name: "cover", type: "image", options: { hotspot: true } }),
    defineField({ name: "buyPdfUrl", type: "url", description: "Optional paid PDF checkout URL." }),
    defineField({ name: "priceDisplay", type: "string", description: "e.g. '$29'" }),
    defineField({
      name: "topics", type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    defineField({ name: "publishedDate", type: "datetime" }),
    defineField({ name: "updatedDate", type: "datetime" }),
    defineField({
      name: "aboutBody", type: "array",
      description: "Long-form book landing content — what's inside, who it's for, how to read.",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "H2", value: "h2" },
            { title: "H3", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
        }),
      ],
    }),
    defineField({ name: "draft", type: "boolean", initialValue: false }),
  ],
  preview: {
    select: { title: "title", subtitle: "subtitle", media: "cover" },
  },
});

export const chapter = defineType({
  name: "chapter",
  title: "Chapter",
  type: "document",
  fields: [
    defineField({ name: "title", type: "string", validation: r => r.required() }),
    defineField({
      name: "slug", type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: r => r.required(),
    }),
    defineField({
      name: "book", type: "reference", to: [{ type: "book" }],
      validation: r => r.required(),
    }),
    defineField({ name: "order", type: "number", initialValue: 100, description: "Reading order within the book." }),
    defineField({ name: "part", type: "string", description: "Optional part / section grouping (e.g. 'Part I: Fundamentals')." }),
    defineField({ name: "description", type: "text", rows: 2 }),
    defineField({ name: "readMinutes", type: "number", description: "Estimated read time." }),
    defineField({ name: "publishedDate", type: "datetime" }),
    defineField({
      name: "body", type: "array",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "H2", value: "h2" },
            { title: "H3", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Emphasis", value: "em" },
              { title: "Code", value: "code" },
            ],
            annotations: [
              {
                name: "link", type: "object", title: "External link",
                fields: [
                  { name: "href", type: "url", title: "URL" },
                  { name: "blank", type: "boolean", title: "Open in new tab" },
                ],
              },
            ],
          },
        }),
        defineArrayMember({ type: "image", options: { hotspot: true } }),
        defineArrayMember({
          name: "codeBlock", type: "object", title: "Code Block",
          fields: [
            { name: "language", type: "string", title: "Language" },
            { name: "code", type: "text", title: "Code" },
            { name: "filename", type: "string", title: "Filename (optional)" },
          ],
        }),
      ],
    }),
    defineField({ name: "draft", type: "boolean", initialValue: true }),
  ],
  preview: {
    select: { title: "title", subtitle: "book.title", order: "order" },
    prepare: ({ title, subtitle, order }) => ({
      title: `${order != null ? `${order}. ` : ""}${title}`,
      subtitle: subtitle ? `→ ${subtitle}` : "unassigned",
    }),
  },
  orderings: [
    { title: "Reading order", name: "orderAsc", by: [{ field: "order", direction: "asc" }] },
  ],
});

// ─── PODCAST EPISODES ─────────────────────────────
// Podcast: `dedwrong` — episode = one show. Number, title, slug, audio URL,
// duration, publish date, show notes body, transcript body, guest, tags.
export const episode = defineType({
  name: "episode",
  title: "Episode",
  type: "document",
  fields: [
    defineField({ name: "number", type: "number", validation: r => r.required(), description: "Episode number, monotonic." }),
    defineField({ name: "title", type: "string", validation: r => r.required() }),
    defineField({
      name: "slug", type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: r => r.required(),
    }),
    defineField({ name: "tagline", type: "text", rows: 2, description: "One-line hook shown in cards." }),
    defineField({ name: "description", type: "text", rows: 3, description: "Longer summary; shown on episode landing." }),
    defineField({ name: "audioUrl", type: "url", description: "Direct MP3/AAC URL. R2, Cloudflare Stream, or a podcast host CDN." }),
    defineField({ name: "audioBytes", type: "number", description: "File size in bytes — required by podcast RSS. Look it up once and paste." }),
    defineField({
      name: "durationSeconds", type: "number",
      description: "Length in seconds. RSS emits HH:MM:SS.",
    }),
    defineField({ name: "publishedDate", type: "datetime", validation: r => r.required() }),
    defineField({
      name: "explicit", type: "boolean", initialValue: false,
      description: "Sets <itunes:explicit> in the RSS feed.",
    }),
    defineField({
      name: "kind", type: "string",
      options: { list: ["full", "trailer", "bonus"] },
      initialValue: "full",
    }),
    defineField({ name: "season", type: "number", initialValue: 1 }),
    defineField({ name: "guests", type: "array", of: [defineArrayMember({ type: "string" })], description: "Guest names, if any." }),
    defineField({
      name: "cover", type: "image", options: { hotspot: true },
      description: "Optional per-episode art. Falls back to show art.",
    }),
    defineField({
      name: "tags", type: "array",
      of: [defineArrayMember({ type: "string" })],
      options: { layout: "tags" },
    }),
    defineField({
      name: "showNotes", type: "array",
      description: "The equivalent of blog body — links, chapters, references, expanded thoughts.",
      of: [
        defineArrayMember({
          type: "block",
          styles: [
            { title: "Normal", value: "normal" },
            { title: "H2", value: "h2" },
            { title: "H3", value: "h3" },
            { title: "Quote", value: "blockquote" },
          ],
          marks: {
            decorators: [
              { title: "Strong", value: "strong" },
              { title: "Emphasis", value: "em" },
              { title: "Code", value: "code" },
            ],
            annotations: [
              {
                name: "link", type: "object", title: "External link",
                fields: [
                  { name: "href", type: "url", title: "URL" },
                  { name: "blank", type: "boolean", title: "Open in new tab" },
                ],
              },
            ],
          },
        }),
        defineArrayMember({ type: "image", options: { hotspot: true } }),
      ],
    }),
    defineField({
      name: "chapters", type: "array",
      description: "Timestamped chapter markers. Optional but recommended.",
      of: [defineArrayMember({
        type: "object",
        fields: [
          { name: "timestamp", type: "string", title: "Timestamp (HH:MM:SS)" },
          { name: "title", type: "string", title: "Title" },
        ],
      })],
    }),
    defineField({
      name: "transcript", type: "array",
      description: "Full transcript. SEO gold. Collapsed on the episode page.",
      of: [defineArrayMember({ type: "block" })],
    }),
    defineField({ name: "draft", type: "boolean", initialValue: true }),
  ],
  preview: {
    select: { number: "number", title: "title", subtitle: "publishedDate" },
    prepare: ({ number, title, subtitle }) => ({
      title: `#${number} — ${title}`,
      subtitle: subtitle ? new Date(subtitle).toDateString() : "unpublished",
    }),
  },
  orderings: [
    { title: "Newest", name: "numDesc", by: [{ field: "number", direction: "desc" }] },
    { title: "Oldest", name: "numAsc",  by: [{ field: "number", direction: "asc" }] },
  ],
});

export const schemaTypes = [post, page, author, project, product, course, book, chapter, episode];
