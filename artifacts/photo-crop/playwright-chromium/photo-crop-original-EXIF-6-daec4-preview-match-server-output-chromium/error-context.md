# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: photo-crop.spec.ts >> original EXIF 6 bytes and cropped browser preview match server output
- Location: tests/e2e/photo-crop.spec.ts:368:7

# Error details

```
Error: expect(received).toEqual(expected) // deep equality

Expected: {"data": [255, 216, 255, 225, 0, 188, 69, 120, 105, 102, …], "type": "Buffer"}
Received: null
```

# Page snapshot

```yaml
- generic [ref=f1e1]:
  - link "Skip to content" [ref=f1e2] [cursor=pointer]:
    - /url: "#main"
  - generic [ref=f1e3]:
    - banner [ref=f1e4]:
      - generic [ref=f1e5]:
        - link "Linky" [ref=f1e6] [cursor=pointer]:
          - /url: /app/profiles
        - navigation "Workspace" [ref=f1e7]:
          - link "Profiles" [ref=f1e8] [cursor=pointer]:
            - /url: /app/profiles
        - generic [ref=f1e9]:
          - generic "e2e-ca09b80a-5a40-4ba5-9e33-1ed32f02009f@example.test" [ref=f1e10]
          - button "Sign out" [ref=f1e12] [cursor=pointer]
    - main [ref=f1e13]:
      - generic [ref=f1e14]:
        - link "‹ Profiles" [ref=f1e15] [cursor=pointer]:
          - /url: /app/profiles?q=&filter=all
        - generic [ref=f1e16]:
          - generic [ref=f1e17]: Editing a profile
          - combobox "Editing a profile" [ref=f1e18]:
            - option "Private exif6 · /@e2e-edd4aa34-exif6" [selected]
        - status [ref=f1e19]: Unsaved changes
      - region "Publication" [ref=f1e20]:
        - generic [ref=f1e21]:
          - paragraph [ref=f1e22]: Private draft
          - paragraph [ref=f1e23]: Draft edits stay private until you publish.
          - paragraph [ref=f1e24]: Wait for the draft to finish saving before publishing.
        - button "Publish" [disabled] [ref=f1e26]
      - status [ref=f1e27]
      - generic [ref=f1e28]:
        - generic [ref=f1e29]:
          - navigation "Editor sections" [ref=f1e30]:
            - button "Content" [ref=f1e31] [cursor=pointer]
            - button "Appearance" [pressed] [ref=f1e32] [cursor=pointer]
            - button "Settings" [ref=f1e33] [cursor=pointer]
          - group [ref=f1e34]:
            - generic [ref=f1e35]:
              - heading "01 Appearance" [level=1] [ref=f1e36]:
                - generic [ref=f1e37]: "01"
                - text: Appearance
              - paragraph [ref=f1e38]: A quiet frame for your work. Every choice keeps your content and its order.
              - generic [ref=f1e39]:
                - generic [aria-hidden] [ref=f1e40]: Aa
                - generic [ref=f1e41]:
                  - text: Template
                  - strong [ref=f1e42]: Original
                - button "Change template" [ref=f1e43] [cursor=pointer]
              - group [ref=f1e44]:
                - generic "Profile images (optional)" [ref=f1e45] [cursor=pointer]
                - region [ref=f1e46]:
                  - heading "Profile photo" [level=2] [ref=f1e47]
                  - generic [ref=f1e50]:
                    - generic [ref=f1e51]:
                      - button "Replace photo" [ref=f1e52] [cursor=pointer]
                      - button "Remove photo" [ref=f1e53] [cursor=pointer]
                    - paragraph [ref=f1e54]: JPEG, PNG, or WebP · up to 3 MB
                  - status [active] [ref=f1e55]: Photo updated in this draft. Changes stay private until you publish.
                  - group [ref=f1e56]:
                    - generic "Use an image URL instead" [ref=f1e57] [cursor=pointer]
                - generic [ref=f1e59]:
                  - generic [ref=f1e60]: Cover URL
                  - textbox "Cover URL" [ref=f1e61]
                  - generic [ref=f1e62]: Optional HTTPS image URL. The image is decorative; keep essential information in your text.
              - group "Color theme" [ref=f1e63]:
                - generic [ref=f1e65]:
                  - generic [ref=f1e66] [cursor=pointer]:
                    - radio "Cool white White background, navy text, blue links." [checked] [ref=f1e67]
                    - generic [ref=f1e68]:
                      - strong [ref=f1e69]: Cool white
                      - generic [ref=f1e70]: White background, navy text, blue links.
                  - generic [ref=f1e71] [cursor=pointer]:
                    - radio "Midnight navy Navy background, cool white text, light blue links." [ref=f1e72]
                    - generic [ref=f1e73]:
                      - strong [ref=f1e74]: Midnight navy
                      - generic [ref=f1e75]: Navy background, cool white text, light blue links.
              - group "Reading rhythm" [ref=f1e76]:
                - generic [ref=f1e78]:
                  - generic [ref=f1e79] [cursor=pointer]:
                    - radio "Editorial Room for each link and a generous pace." [checked] [ref=f1e80]
                    - generic [ref=f1e81]:
                      - strong [ref=f1e82]: Editorial
                      - generic [ref=f1e83]: Room for each link and a generous pace.
                  - generic [ref=f1e84] [cursor=pointer]:
                    - radio "Concise A closer rhythm for a longer collection." [ref=f1e85]
                    - generic [ref=f1e86]:
                      - strong [ref=f1e87]: Concise
                      - generic [ref=f1e88]: A closer rhythm for a longer collection.
              - group "Link corners" [ref=f1e89]:
                - generic [ref=f1e91]:
                  - generic [ref=f1e92] [cursor=pointer]:
                    - radio "Soft Curves suited to your template." [checked] [ref=f1e93]
                    - generic [ref=f1e94]:
                      - strong [ref=f1e95]: Soft
                      - generic [ref=f1e96]: Curves suited to your template.
                  - generic [ref=f1e97] [cursor=pointer]:
                    - radio "Square Straight edges, like a printed index." [ref=f1e98]
                    - generic [ref=f1e99]:
                      - strong [ref=f1e100]: Square
                      - generic [ref=f1e101]: Straight edges, like a printed index.
        - complementary "Private draft preview" [ref=f1e102]:
          - generic [ref=f1e103]:
            - heading "Draft preview" [level=2] [ref=f1e104]
            - generic [ref=f1e105]: Private
          - paragraph [ref=f1e106]: Visitors still see the last published snapshot./@e2e-edd4aa34-exif6
          - article [ref=f1e109]:
            - generic [ref=f1e110]:
              - heading "Public exif6" [level=2] [ref=f1e111]
              - paragraph
            - paragraph [ref=f1e112]: Add or show a content block to begin.
            - generic [ref=f1e113]: Private draft preview. Links are disabled.
  - alert [ref=f1e114]
```

# Test source

```ts
  319 |     await expect(dialogFor(page).getByRole("alert")).toHaveCount(0);
  320 |     await page.keyboard.press("Escape");
  321 |     await inputFor(page).setInputFiles({
  322 |       name: "large.png",
  323 |       mimeType: "image/png",
  324 |       buffer: await sharp({
  325 |         create: { width: 5000, height: 4001, channels: 3, background: "navy" },
  326 |       })
  327 |         .png()
  328 |         .toBuffer(),
  329 |     });
  330 |     await expect(dialogFor(page).getByRole("alert")).toHaveText(
  331 |       "Choose a photo up to 20 megapixels.",
  332 |     );
  333 |     await expect(
  334 |       dialogFor(page).getByRole("button", {
  335 |         name: "Upload photo",
  336 |         exact: true,
  337 |       }),
  338 |     ).toBeDisabled();
  339 |     await page.keyboard.press("Escape");
  340 |     await inputFor(page).setInputFiles({
  341 |       name: "large.jpg",
  342 |       mimeType: "image/jpeg",
  343 |       buffer: Buffer.alloc(3 * 1024 * 1024 + 1),
  344 |     });
  345 |     await expect(page.locator("#profile-photo-error")).toBeFocused();
  346 |     await expect(dialogFor(page)).not.toBeVisible();
  347 |     const urls = await page.evaluate(() => {
  348 |       const state = window as typeof window & {
  349 |         photoUrls: string[];
  350 |         revokedPhotoUrls: string[];
  351 |       };
  352 |       return { made: state.photoUrls, revoked: state.revokedPhotoUrls };
  353 |     });
  354 |     expect(urls.made.length).toBeGreaterThanOrEqual(4);
  355 |     expect([...new Set(urls.made)].sort()).toEqual(
  356 |       [...new Set(urls.revoked)].sort(),
  357 |     );
  358 |     expect(posts).toBe(0);
  359 |   } finally {
  360 |     await cleanup(id, email);
  361 |   }
  362 | });
  363 | 
  364 | for (const orientation of [2, 6, 7]) {
  365 |   test(`original EXIF ${orientation} bytes and cropped browser preview match server output`, async ({
  366 |     page,
  367 |   }, info) => {
  368 |     const { email, id } = await setup(page, `exif${orientation}`);
  369 |     try {
  370 |       const original = await fixture(orientation);
  371 |       await writeFile(
  372 |         `${directory}/asymmetric-exif-${orientation}.jpg`,
  373 |         original.buffer,
  374 |       );
  375 |       await inputFor(page).setInputFiles(original);
  376 |       await ready(page);
  377 |       const dialog = dialogFor(page),
  378 |         viewport = dialog.getByRole("group", {
  379 |           name: "Photo crop preview",
  380 |           exact: true,
  381 |         });
  382 |       const dimensions = await viewport
  383 |         .locator("img")
  384 |         .evaluate((image) => ({
  385 |           width: (image as HTMLImageElement).naturalWidth,
  386 |           height: (image as HTMLImageElement).naturalHeight,
  387 |         }));
  388 |       expect(dimensions).toEqual(
  389 |         orientation >= 5
  390 |           ? { width: 240, height: 360 }
  391 |           : { width: 360, height: 240 },
  392 |       );
  393 |       await dialog.getByRole("slider", { name: "Zoom" }).press("End");
  394 |       await viewport.focus();
  395 |       await viewport.press("Shift+ArrowLeft");
  396 |       await viewport.press("Shift+ArrowUp");
  397 |       await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
  398 |       const preview = await viewport.screenshot({
  399 |         path: `${directory}/preview-exif-${orientation}-${info.project.name}.png`,
  400 |       });
  401 |       const requestPromise = page.waitForRequest(
  402 |         (request) =>
  403 |           request.method() === "POST" &&
  404 |           request.url().endsWith(`/api/profiles/${id}/photo`),
  405 |       );
  406 |       const responsePromise = page.waitForResponse(
  407 |         (response) =>
  408 |           response.request().method() === "POST" &&
  409 |           response.url().endsWith(`/api/profiles/${id}/photo`),
  410 |       );
  411 |       await dialog
  412 |         .getByRole("button", { name: "Upload photo", exact: true })
  413 |         .click();
  414 |       const request = await requestPromise,
  415 |         response = await responsePromise;
  416 |       expect(request.postDataBuffer()).toEqual(original.buffer);
  417 |       expect(request.headers()["content-type"]).toBe("image/jpeg");
  418 |       const crop = JSON.parse(request.headers()["x-photo-crop"]);
> 419 |       expect(crop.zoom).toBe(3);
      |                                        ^ Error: expect(received).toEqual(expected) // deep equality
  420 |       expect(crop.centerX).toBeCloseTo(0.5 + (0.1 * 80) / dimensions.width);
  421 |       expect(crop.centerY).toBeCloseTo(0.5 + (0.1 * 80) / dimensions.height);
  422 |       expect(response.ok(), await response.text()).toBe(true);
  423 |       await expect(page.locator("#profile-photo-status")).toContainText(
  424 |         "Photo updated in this draft",
  425 |       );
  426 |       const { avatarUrl } = await response.json();
  427 |       await saved(page);
  428 |       const output = await (await page.request.get(avatarUrl)).body();
  429 |       await writeFile(
  430 |         `${directory}/output-exif-${orientation}-${info.project.name}.webp`,
  431 |         output,
  432 |       );
  433 |       const metadata = await sharp(output).metadata();
  434 |       expect(metadata).toMatchObject({ width: 80, height: 80, format: "webp" });
  435 |       expect(metadata.exif).toBeUndefined();
  436 |       const expected = await sharp(original.buffer)
  437 |         .autoOrient()
  438 |         .extract({
  439 |           left: Math.round(crop.centerX * dimensions.width - 40),
  440 |           top: Math.round(crop.centerY * dimensions.height - 40),
  441 |           width: 80,
  442 |           height: 80,
  443 |         })
  444 |         .webp({ quality: 85 })
  445 |         .toBuffer();
  446 |       expect(output).toEqual(expected);
  447 |       const previewMeta = await sharp(preview).metadata();
  448 |       const rendered = await sharp(preview).removeAlpha().raw().toBuffer();
  449 |       const stored = await sharp(output)
  450 |         .resize(previewMeta.width, previewMeta.height)
  451 |         .removeAlpha()
  452 |         .raw()
  453 |         .toBuffer();
  454 |       const meanError =
  455 |         rendered.reduce(
  456 |           (total, value, index) => total + Math.abs(value - stored[index]),
  457 |           0,
  458 |         ) / rendered.length;
  459 |       expect(meanError).toBeLessThan(4);
  460 |       await writeFile(
  461 |         `${directory}/pixels-exif-${orientation}-${info.project.name}.json`,
  462 |         JSON.stringify(
  463 |           {
  464 |             crop,
  465 |             dimensions,
  466 |             output: { width: metadata.width, height: metadata.height },
  467 |             previewMeanAbsoluteChannelError: meanError,
  468 |             originalBytesUnchanged: true,
  469 |           },
  470 |           null,
  471 |           2,
  472 |         ),
  473 |       );
  474 |       if (orientation === 6) {
  475 |         await page.route(`**/api/profiles/${id}/photo`, (route) =>
  476 |           route.fulfill({
  477 |             status: 503,
  478 |             contentType: "application/json",
  479 |             body: JSON.stringify({
  480 |               error: { message: "Photo storage unavailable. Please retry." },
  481 |             }),
  482 |           }),
  483 |         );
  484 |         await inputFor(page).setInputFiles(original);
  485 |         await ready(page);
  486 |         await dialogFor(page)
  487 |           .getByRole("button", { name: "Upload photo", exact: true })
  488 |           .click();
  489 |         await expect(page.locator("#profile-photo-error")).toBeFocused();
  490 |         await expect(
  491 |           page.locator(".profile-photo-thumbnail img"),
  492 |         ).toHaveAttribute("src", avatarUrl);
  493 |         await page.setViewportSize({ width: 320, height: 568 });
  494 |         await page
  495 |           .locator(".profile-photo")
  496 |           .screenshot({
  497 |             path: `${directory}/upload-error-${info.project.name}-320.png`,
  498 |           });
  499 |       }
  500 |     } finally {
  501 |       await cleanup(id, email);
  502 |     }
  503 |   });
  504 | }
  505 | 
  506 | test("known autosave session expiry keeps crop open with disabled confirmation and no photo POST", async ({
  507 |   page,
  508 | }, info) => {
  509 |   const { email, id } = await setup(page, "cropauth");
  510 |   let posts = 0;
  511 |   page.on("request", (request) => {
  512 |     if (
  513 |       request.method() === "POST" &&
  514 |       request.url().endsWith(`/api/profiles/${id}/photo`)
  515 |     )
  516 |       posts++;
  517 |   });
  518 |   let release!: () => void;
  519 |   const held = new Promise<void>((resolve) => {
```