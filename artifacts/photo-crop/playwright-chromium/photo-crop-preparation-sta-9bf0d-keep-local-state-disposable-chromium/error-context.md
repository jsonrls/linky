# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: photo-crop.spec.ts >> preparation, stale decode cancellation, decode error, choose another and size errors keep local state disposable
- Location: tests/e2e/photo-crop.spec.ts:236:5

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: getByRole('dialog', { name: 'Adjust profile photo' }).getByText('Preparing photo…', { exact: true })
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" getByRole('dialog', { name: 'Adjust profile photo' }).getByText('Preparing photo…', { exact: true }) with timeout 5000ms
  - waiting for getByRole('dialog', { name: 'Adjust profile photo' }).getByText('Preparing photo…', { exact: true })

```

```yaml
- link "Skip to content":
  - /url: "#main"
- banner:
  - link "Linky":
    - /url: /app/profiles
  - navigation "Workspace":
    - link "Profiles":
      - /url: /app/profiles
  - text: e2e-13624275-4b32-410f-aee7-6f86c7253abb@example.test
  - button "Sign out"
- main:
  - link "‹ Profiles":
    - /url: /app/profiles?q=&filter=all
  - text: Editing a profile
  - combobox "Editing a profile":
    - option "Private decode · /@e2e-96e564ca-decode" [selected]
  - status: All changes saved
  - region "Publication":
    - paragraph: Private draft
    - paragraph: Draft edits stay private until you publish.
    - button "Publish"
  - status
  - navigation "Editor sections":
    - button "Content"
    - button "Appearance" [pressed]
    - button "Settings"
  - group:
    - heading "01 Appearance" [level=1]
    - paragraph: A quiet frame for your work. Every choice keeps your content and its order.
    - text: Template
    - strong: Original
    - button "Change template"
    - group:
      - text: Profile images (optional)
      - region "Profile photo":
        - heading "Profile photo" [level=2]
        - button "Upload photo"
        - paragraph: JPEG, PNG, or WebP · up to 3 MB
        - status: Photo changes stay private until you publish.
        - group: Use an image URL instead
        - dialog "Adjust profile photo":
          - heading "Adjust profile photo" [level=2]
          - button "Close dialog": ×
          - paragraph: Drag the photo or use the direction buttons to reposition it. Use arrow keys for small moves, or Shift + arrow keys for larger moves.
          - group "Photo crop preview":
            - img "Selected photo within the square crop"
          - group "Move photo":
            - button "Move photo left"
            - button "Move photo right"
            - button "Move photo up"
            - button "Move photo down"
          - text: Zoom
          - status: 100%
          - slider "Zoom": "100"
          - button "Reset"
          - button "Cancel"
          - button "Upload photo"
      - text: Cover URL
      - textbox "Cover URL"
      - text: Optional HTTPS image URL. The image is decorative; keep essential information in your text.
    - group "Color theme":
      - text: Color theme
      - radio "Cool white White background, navy text, blue links." [checked]
      - strong: Cool white
      - text: White background, navy text, blue links.
      - radio "Midnight navy Navy background, cool white text, light blue links."
      - strong: Midnight navy
      - text: Navy background, cool white text, light blue links.
    - group "Reading rhythm":
      - text: Reading rhythm
      - radio "Editorial Room for each link and a generous pace." [checked]
      - strong: Editorial
      - text: Room for each link and a generous pace.
      - radio "Concise A closer rhythm for a longer collection."
      - strong: Concise
      - text: A closer rhythm for a longer collection.
    - group "Link corners":
      - text: Link corners
      - radio "Soft Curves suited to your template." [checked]
      - strong: Soft
      - text: Curves suited to your template.
      - radio "Square Straight edges, like a printed index."
      - strong: Square
      - text: Straight edges, like a printed index.
  - complementary "Private draft preview":
    - heading "Draft preview" [level=2]
    - text: Private
    - paragraph: Visitors still see the last published snapshot. /@e2e-96e564ca-decode
    - article:
      - heading "Public decode" [level=2]
      - paragraph
      - paragraph: Add or show a content block to begin.
      - text: Private draft preview. Links are disabled.
- alert
```

# Test source

```ts
  182 |     await page.setViewportSize({ width: 1280, height: 900 });
  183 |     await dialog.screenshot({
  184 |       path: `${directory}/dialog-${info.project.name}-desktop.png`,
  185 |     });
  186 |     for (const size of [
  187 |       { width: 320, height: 844 },
  188 |       { width: 320, height: 568 },
  189 |       { width: 640, height: 360 },
  190 |     ]) {
  191 |       await page.setViewportSize(size);
  192 |       expect(
  193 |         await page.evaluate(
  194 |           () => document.documentElement.scrollWidth <= innerWidth,
  195 |         ),
  196 |       ).toBe(true);
  197 |       const geometry = await dialog.evaluate((element) => ({
  198 |         width: element.getBoundingClientRect().width,
  199 |         height: element.getBoundingClientRect().height,
  200 |         scrollWidth: element.scrollWidth,
  201 |         clientWidth: element.clientWidth,
  202 |       }));
  203 |       expect(geometry.width).toBeLessThanOrEqual(size.width);
  204 |       expect(geometry.height).toBeLessThanOrEqual(size.height);
  205 |       expect(geometry.scrollWidth).toBeLessThanOrEqual(geometry.clientWidth);
  206 |       await expect(
  207 |         dialog.getByRole("button", { name: "Cancel", exact: true }),
  208 |       ).toBeInViewport();
  209 |       await expect(
  210 |         dialog.getByRole("button", { name: "Upload photo", exact: true }),
  211 |       ).toBeInViewport();
  212 |       const sizes = await dialog
  213 |         .locator("button")
  214 |         .evaluateAll((buttons) =>
  215 |           buttons.map((button) => ({
  216 |             width: button.getBoundingClientRect().width,
  217 |             height: button.getBoundingClientRect().height,
  218 |           })),
  219 |         );
  220 |       expect(
  221 |         sizes.every((target) => target.width >= 44 && target.height >= 44),
  222 |       ).toBe(true);
  223 |       await assertCovered(viewport);
  224 |       await dialog.screenshot({
  225 |         path: `${directory}/dialog-${info.project.name}-${size.width}x${size.height}.png`,
  226 |       });
  227 |     }
  228 |     await page.keyboard.press("Escape");
  229 |     expect(posts).toBe(0);
  230 |     expect(await avatar(page, id)).toBe(before);
  231 |   } finally {
  232 |     await cleanup(id, email);
  233 |   }
  234 | });
  235 | 
  236 | test("preparation, stale decode cancellation, decode error, choose another and size errors keep local state disposable", async ({
  237 |   page,
  238 | }, info) => {
  239 |   const { email, id } = await setup(page, "decode");
  240 |   let posts = 0;
  241 |   page.on("request", (request) => {
  242 |     if (
  243 |       request.method() === "POST" &&
  244 |       request.url().endsWith(`/api/profiles/${id}/photo`)
  245 |     )
  246 |       posts++;
  247 |   });
  248 |   try {
  249 |     await page.evaluate(() => {
  250 |       const state = window as typeof window & {
  251 |         photoUrls: string[];
  252 |         revokedPhotoUrls: string[];
  253 |         releasePhotoDecode?: () => void;
  254 |       };
  255 |       state.photoUrls = [];
  256 |       state.revokedPhotoUrls = [];
  257 |       const create = URL.createObjectURL.bind(URL),
  258 |         revoke = URL.revokeObjectURL.bind(URL);
  259 |       URL.createObjectURL = (blob) => {
  260 |         const url = create(blob);
  261 |         state.photoUrls.push(url);
  262 |         return url;
  263 |       };
  264 |       URL.revokeObjectURL = (url) => {
  265 |         state.revokedPhotoUrls.push(url);
  266 |         revoke(url);
  267 |       };
  268 |       const decode = HTMLImageElement.prototype.decode;
  269 |       HTMLImageElement.prototype.decode = function () {
  270 |         HTMLImageElement.prototype.decode = decode;
  271 |         const image = this;
  272 |         return new Promise<void>((resolve, reject) => {
  273 |           state.releasePhotoDecode = () => {
  274 |             decode.call(image).then(resolve, reject);
  275 |           };
  276 |         });
  277 |       };
  278 |     });
  279 |     await inputFor(page).setInputFiles(await fixture());
  280 |     await expect(
  281 |       dialogFor(page).getByText("Preparing photo…", { exact: true }),
> 282 |     ).toBeVisible();
      |       ^ Error: expect(locator).toBeVisible() failed
  283 |     await expect(
  284 |       dialogFor(page).getByRole("button", {
  285 |         name: "Upload photo",
  286 |         exact: true,
  287 |       }),
  288 |     ).toBeDisabled();
  289 |     await dialogFor(page).screenshot({
  290 |       path: `${directory}/preparing-${info.project.name}.png`,
  291 |     });
  292 |     await page.keyboard.press("Escape");
  293 |     await page.evaluate(() =>
  294 |       (
  295 |         window as typeof window & { releasePhotoDecode?: () => void }
  296 |       ).releasePhotoDecode?.(),
  297 |     );
  298 |     await expect(dialogFor(page)).not.toBeVisible();
  299 |     await inputFor(page).setInputFiles({
  300 |       name: "bad.png",
  301 |       mimeType: "image/png",
  302 |       buffer: Buffer.from("not a photo"),
  303 |     });
  304 |     await expect(dialogFor(page).getByRole("alert")).toBeFocused();
  305 |     await expect(
  306 |       dialogFor(page).getByRole("button", {
  307 |         name: "Upload photo",
  308 |         exact: true,
  309 |       }),
  310 |     ).toBeDisabled();
  311 |     await page.setViewportSize({ width: 320, height: 568 });
  312 |     await dialogFor(page).screenshot({
  313 |       path: `${directory}/decode-error-${info.project.name}-320.png`,
  314 |     });
  315 |     const picker = page.waitForEvent("filechooser");
  316 |     await dialogFor(page)
  317 |       .getByRole("button", { name: "Choose another photo", exact: true })
  318 |       .click();
  319 |     await (await picker).setFiles(await fixture(7));
  320 |     await ready(page);
  321 |     await expect(dialogFor(page).locator("output")).toHaveText("100%");
  322 |     await expect(dialogFor(page).getByRole("alert")).toHaveCount(0);
  323 |     await page.keyboard.press("Escape");
  324 |     await inputFor(page).setInputFiles({
  325 |       name: "large.png",
  326 |       mimeType: "image/png",
  327 |       buffer: await sharp({
  328 |         create: { width: 5000, height: 4001, channels: 3, background: "navy" },
  329 |       })
  330 |         .png()
  331 |         .toBuffer(),
  332 |     });
  333 |     await expect(dialogFor(page).getByRole("alert")).toHaveText(
  334 |       "Choose a photo up to 20 megapixels.",
  335 |     );
  336 |     await expect(
  337 |       dialogFor(page).getByRole("button", {
  338 |         name: "Upload photo",
  339 |         exact: true,
  340 |       }),
  341 |     ).toBeDisabled();
  342 |     await page.keyboard.press("Escape");
  343 |     await inputFor(page).setInputFiles({
  344 |       name: "large.jpg",
  345 |       mimeType: "image/jpeg",
  346 |       buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
  347 |     });
  348 |     await expect(page.locator("#profile-photo-error")).toBeFocused();
  349 |     await expect(dialogFor(page)).not.toBeVisible();
  350 |     const urls = await page.evaluate(() => {
  351 |       const state = window as typeof window & {
  352 |         photoUrls: string[];
  353 |         revokedPhotoUrls: string[];
  354 |       };
  355 |       return { made: state.photoUrls, revoked: state.revokedPhotoUrls };
  356 |     });
  357 |     expect(urls.made.length).toBeGreaterThanOrEqual(4);
  358 |     expect([...new Set(urls.made)].sort()).toEqual(
  359 |       [...new Set(urls.revoked)].sort(),
  360 |     );
  361 |     expect(posts).toBe(0);
  362 |   } finally {
  363 |     await cleanup(id, email);
  364 |   }
  365 | });
  366 | 
  367 | for (const orientation of [2, 6, 7]) {
  368 |   test(`original EXIF ${orientation} bytes and cropped browser preview match server output`, async ({
  369 |     page,
  370 |   }, info) => {
  371 |     const { email, id } = await setup(page, `exif${orientation}`);
  372 |     try {
  373 |       const original = await fixture(orientation);
  374 |       await writeFile(
  375 |         `${directory}/asymmetric-exif-${orientation}.jpg`,
  376 |         original.buffer,
  377 |       );
  378 |       await inputFor(page).setInputFiles(original);
  379 |       await ready(page);
  380 |       const dialog = dialogFor(page),
  381 |         viewport = dialog.getByRole("group", {
  382 |           name: "Photo crop preview",
```