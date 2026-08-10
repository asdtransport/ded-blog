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

export const schemaTypes = [post, page, author, project];
