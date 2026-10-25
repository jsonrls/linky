# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: photo-crop.spec.ts >> original EXIF 2 bytes and cropped browser preview match server output
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
          - generic "e2e-88eedccb-9bc9-4a33-81f8-b684e25c283b@example.test" [ref=f1e10]
          - button "Sign out" [ref=f1e12] [cursor=pointer]
    - main [ref=f1e13]:
      - generic [ref=f1e14]:
        - link "‹ Profiles" [ref=f1e15] [cursor=pointer]:
          - /url: /app/profiles?q=&filter=all
        - generic [ref=f1e16]:
          - generic [ref=f1e17]: Editing a profile
          - combobox "Editing a profile" [ref=f1e18]:
            - option "Private exif2 · /@e2e-a12fbc6d-exif2" [selected]
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
                  - generic [ref=f1e48]:
                    - generic [ref=f1e49]:
                      - generic [aria-hidden] [ref=f1e50]: PE
                      - status [ref=f1e51]: Could not load image
                    - generic [ref=f1e52]:
                      - generic [ref=f1e53]:
                        - button "Replace photo" [ref=f1e54] [cursor=pointer]
                        - button "Remove photo" [ref=f1e55] [cursor=pointer]
                      - paragraph [ref=f1e56]: JPEG, PNG, or WebP · up to 3 MB
                  - status [active] [ref=f1e57]: Photo updated in this draft. Changes stay private until you publish.
                  - group [ref=f1e58]:
                    - generic "Use an image URL instead" [ref=f1e59] [cursor=pointer]
                - generic [ref=f1e61]:
                  - generic [ref=f1e62]: Cover URL
                  - textbox "Cover URL" [ref=f1e63]
                  - generic [ref=f1e64]: Optional HTTPS image URL. The image is decorative; keep essential information in your text.
              - group "Color theme" [ref=f1e65]:
                - generic [ref=f1e67]:
                  - generic [ref=f1e68] [cursor=pointer]:
                    - radio "Cool white White background, navy text, blue links." [checked] [ref=f1e69]
                    - generic [ref=f1e70]:
                      - strong [ref=f1e71]: Cool white
                      - generic [ref=f1e72]: White background, navy text, blue links.
                  - generic [ref=f1e73] [cursor=pointer]:
                    - radio "Midnight navy Navy background, cool white text, light blue links." [ref=f1e74]
                    - generic [ref=f1e75]:
                      - strong [ref=f1e76]: Midnight navy
                      - generic [ref=f1e77]: Navy background, cool white text, light blue links.
              - group "Reading rhythm" [ref=f1e78]:
                - generic [ref=f1e80]:
                  - generic [ref=f1e81] [cursor=pointer]:
                    - radio "Editorial Room for each link and a generous pace." [checked] [ref=f1e82]
                    - generic [ref=f1e83]:
                      - strong [ref=f1e84]: Editorial
                      - generic [ref=f1e85]: Room for each link and a generous pace.
                  - generic [ref=f1e86] [cursor=pointer]:
                    - radio "Concise A closer rhythm for a longer collection." [ref=f1e87]
                    - generic [ref=f1e88]:
                      - strong [ref=f1e89]: Concise
                      - generic [ref=f1e90]: A closer rhythm for a longer collection.
              - group "Link corners" [ref=f1e91]:
                - generic [ref=f1e93]:
                  - generic [ref=f1e94] [cursor=pointer]:
                    - radio "Soft Curves suited to your template." [checked] [ref=f1e95]
                    - generic [ref=f1e96]:
                      - strong [ref=f1e97]: Soft
                      - generic [ref=f1e98]: Curves suited to your template.
                  - generic [ref=f1e99] [cursor=pointer]:
                    - radio "Square Straight edges, like a printed index." [ref=f1e100]
                    - generic [ref=f1e101]:
                      - strong [ref=f1e102]: Square
                      - generic [ref=f1e103]: Straight edges, like a printed index.
        - complementary "Private draft preview" [ref=f1e104]:
          - generic [ref=f1e105]:
            - heading "Draft preview" [level=2] [ref=f1e106]
            - generic [ref=f1e107]: Private
          - paragraph [ref=f1e108]: Visitors still see the last published snapshot./@e2e-a12fbc6d-exif2
          - article [ref=f1e111]:
            - generic [ref=f1e112]:
              - generic [aria-hidden] [ref=f1e113]: PE
              - heading "Public exif2" [level=2] [ref=f1e114]
              - paragraph
            - paragraph [ref=f1e115]: Add or show a content block to begin.
            - generic [ref=f1e116]: Private draft preview. Links are disabled.
  - alert [ref=f1e117]
```

# Test source

```ts
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
  383 |           exact: true,
  384 |         });
  385 |       const dimensions = await viewport
  386 |         .locator("img")
  387 |         .evaluate((image) => ({
  388 |           width: image.naturalWidth,
  389 |           height: image.naturalHeight,
  390 |         }));
  391 |       expect(dimensions).toEqual(
  392 |         orientation >= 5
  393 |           ? { width: 240, height: 360 }
  394 |           : { width: 360, height: 240 },
  395 |       );
  396 |       await dialog.getByRole("slider", { name: "Zoom" }).press("End");
  397 |       await viewport.focus();
  398 |       await viewport.press("Shift+ArrowLeft");
  399 |       await viewport.press("Shift+ArrowUp");
  400 |       await dialog.getByRole("button", { name: "Cancel", exact: true }).focus();
  401 |       const preview = await viewport.screenshot({
  402 |         path: `${directory}/preview-exif-${orientation}-${info.project.name}.png`,
  403 |       });
  404 |       const requestPromise = page.waitForRequest(
  405 |         (request) =>
  406 |           request.method() === "POST" &&
  407 |           request.url().endsWith(`/api/profiles/${id}/photo`),
  408 |       );
  409 |       const responsePromise = page.waitForResponse(
  410 |         (response) =>
  411 |           response.request().method() === "POST" &&
  412 |           response.url().endsWith(`/api/profiles/${id}/photo`),
  413 |       );
  414 |       await dialog
  415 |         .getByRole("button", { name: "Upload photo", exact: true })
  416 |         .click();
  417 |       const request = await requestPromise,
  418 |         response = await responsePromise;
> 419 |       expect(request.postDataBuffer()).toEqual(original.buffer);
      |                                        ^ Error: expect(received).toEqual(expected) // deep equality
  420 |       expect(request.headers()["content-type"]).toBe("image/jpeg");
  421 |       const crop = JSON.parse(request.headers()["x-photo-crop"]);
  422 |       expect(crop.zoom).toBe(3);
  423 |       expect(crop.centerX).toBeCloseTo(0.5 + (0.1 * 80) / dimensions.width);
  424 |       expect(crop.centerY).toBeCloseTo(0.5 + (0.1 * 80) / dimensions.height);
  425 |       expect(response.ok(), await response.text()).toBe(true);
  426 |       await expect(page.locator("#profile-photo-status")).toContainText(
  427 |         "Photo updated in this draft",
  428 |       );
  429 |       const { avatarUrl } = await response.json();
  430 |       await saved(page);
  431 |       const output = await (await page.request.get(avatarUrl)).body();
  432 |       await writeFile(
  433 |         `${directory}/output-exif-${orientation}-${info.project.name}.webp`,
  434 |         output,
  435 |       );
  436 |       const metadata = await sharp(output).metadata();
  437 |       expect(metadata).toMatchObject({ width: 80, height: 80, format: "webp" });
  438 |       expect(metadata.exif).toBeUndefined();
  439 |       const expected = await sharp(original.buffer)
  440 |         .autoOrient()
  441 |         .extract({
  442 |           left: Math.round(crop.centerX * dimensions.width - 40),
  443 |           top: Math.round(crop.centerY * dimensions.height - 40),
  444 |           width: 80,
  445 |           height: 80,
  446 |         })
  447 |         .webp({ quality: 85 })
  448 |         .toBuffer();
  449 |       expect(output).toEqual(expected);
  450 |       const previewMeta = await sharp(preview).metadata();
  451 |       const rendered = await sharp(preview).removeAlpha().raw().toBuffer();
  452 |       const stored = await sharp(output)
  453 |         .resize(previewMeta.width, previewMeta.height)
  454 |         .removeAlpha()
  455 |         .raw()
  456 |         .toBuffer();
  457 |       const meanError =
  458 |         rendered.reduce(
  459 |           (total, value, index) => total + Math.abs(value - stored[index]),
  460 |           0,
  461 |         ) / rendered.length;
  462 |       expect(meanError).toBeLessThan(4);
  463 |       await writeFile(
  464 |         `${directory}/pixels-exif-${orientation}-${info.project.name}.json`,
  465 |         JSON.stringify(
  466 |           {
  467 |             crop,
  468 |             dimensions,
  469 |             output: { width: metadata.width, height: metadata.height },
  470 |             previewMeanAbsoluteChannelError: meanError,
  471 |             originalBytesUnchanged: true,
  472 |           },
  473 |           null,
  474 |           2,
  475 |         ),
  476 |       );
  477 |       if (orientation === 6) {
  478 |         await page.route(`**/api/profiles/${id}/photo`, (route) =>
  479 |           route.fulfill({
  480 |             status: 503,
  481 |             contentType: "application/json",
  482 |             body: JSON.stringify({
  483 |               error: { message: "Photo storage unavailable. Please retry." },
  484 |             }),
  485 |           }),
  486 |         );
  487 |         await inputFor(page).setInputFiles(original);
  488 |         await ready(page);
  489 |         await dialogFor(page)
  490 |           .getByRole("button", { name: "Upload photo", exact: true })
  491 |           .click();
  492 |         await expect(page.locator("#profile-photo-error")).toBeFocused();
  493 |         await expect(
  494 |           page.locator(".profile-photo-thumbnail img"),
  495 |         ).toHaveAttribute("src", avatarUrl);
  496 |         await page.setViewportSize({ width: 320, height: 568 });
  497 |         await page
  498 |           .locator(".profile-photo")
  499 |           .screenshot({
  500 |             path: `${directory}/upload-error-${info.project.name}-320.png`,
  501 |           });
  502 |       }
  503 |     } finally {
  504 |       await cleanup(id, email);
  505 |     }
  506 |   });
  507 | }
  508 | 
  509 | test("known autosave session expiry keeps crop open with disabled confirmation and no photo POST", async ({
  510 |   page,
  511 | }, info) => {
  512 |   const { email, id } = await setup(page, "cropauth");
  513 |   let posts = 0;
  514 |   page.on("request", (request) => {
  515 |     if (
  516 |       request.method() === "POST" &&
  517 |       request.url().endsWith(`/api/profiles/${id}/photo`)
  518 |     )
  519 |       posts++;
```