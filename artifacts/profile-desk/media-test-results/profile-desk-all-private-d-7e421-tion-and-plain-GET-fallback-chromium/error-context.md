# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: profile-desk.spec.ts >> all-private default, published template/media isolation and plain GET fallback
- Location: tests/e2e/profile-desk.spec.ts:408:5

# Error details

```
Test timeout of 90000ms exceeded.
```

# Page snapshot

```yaml
- generic [active] [ref=f2e1]:
  - link "Skip to content" [ref=f2e2] [cursor=pointer]:
    - /url: "#main"
  - generic [ref=f2e3]:
    - banner [ref=f2e4]:
      - generic [ref=f2e5]:
        - link "Linky" [ref=f2e6] [cursor=pointer]:
          - /url: /app/profiles
        - navigation "Workspace" [ref=f2e7]:
          - link "Profiles" [ref=f2e8] [cursor=pointer]:
            - /url: /app/profiles
        - generic [ref=f2e9]:
          - generic "e2e-a8b3de16-b2da-4e3d-967f-724b712f6f42@example.test" [ref=f2e10]
          - button "Sign out" [ref=f2e12] [cursor=pointer]
    - main [ref=f2e13]:
      - region "Profile workspace" [ref=f2e14]:
        - generic [ref=f2e15]:
          - generic [ref=f2e16]:
            - heading "Profiles" [level=1] [ref=f2e17]
            - paragraph [ref=f2e18]: A space for each part of your work.Choose a page, make it yours, and share it.
          - generic [ref=f2e19]:
            - button "Create profile" [ref=f2e20] [cursor=pointer]
            - paragraph [ref=f2e21]: 1 of 2 published profiles
        - generic [ref=f2e22]:
          - generic [ref=f2e23]:
            - generic [ref=f2e24]: Find a profile
            - generic [ref=f2e25]:
              - searchbox "Find a profile" [ref=f2e26]
              - button "Search" [ref=f2e27] [cursor=pointer]
          - group "Filter profiles" [ref=f2e29]:
            - button "All" [pressed] [ref=f2e31] [cursor=pointer]
            - button "Published" [ref=f2e32] [cursor=pointer]
            - button "Not published" [ref=f2e33] [cursor=pointer]
        - generic [ref=f2e34]:
          - generic [ref=f2e35]: 2 profiles
          - generic [ref=f2e36]: Private drafts & published snapshots
        - list [ref=f2e37]:
          - listitem [ref=f2e38]:
            - generic [aria-hidden] [ref=f2e39]: PC
            - generic [ref=f2e40]:
              - heading "Published media desk" [level=2] [ref=f2e41]
              - generic [ref=f2e42]:
                - generic [ref=f2e43]: "Public name: Private changed identity"
                - generic [ref=f2e44]: /@desk-1a99ff13
              - paragraph [ref=f2e45]: Published · unpublished changes
              - paragraph [ref=f2e46]: Edited 10/23/2026, 6:32:58 PM UTC
            - generic [ref=f2e47]:
              - 'button "Selected: Published media desk" [pressed] [ref=f2e49] [cursor=pointer]': Selected
              - link "Edit profile" [ref=f2e50] [cursor=pointer]:
                - /url: /app/profiles/d7ecf193-7b9b-4723-aea5-ed6df7393486/edit?back=%2Fapp%2Fprofiles%3Fq%3D%26filter%3Dall%26selected%3Dd7ecf193-7b9b-4723-aea5-ed6df7393486
              - link "View live" [ref=f2e51] [cursor=pointer]:
                - /url: /@desk-1a99ff13
          - listitem [ref=f2e52]:
            - generic [aria-hidden] [ref=f2e53]: PN
            - generic [ref=f2e54]:
              - heading "Private-only desk" [level=2] [ref=f2e55]
              - generic [ref=f2e56]:
                - generic [ref=f2e57]: "Public name: Private-only name"
                - generic [ref=f2e58]: /@desk-74120ab0
              - paragraph [ref=f2e59]: Private draft
              - paragraph [ref=f2e60]: Edited 10/23/2026, 6:32:57 PM UTC
            - generic [ref=f2e61]:
              - 'button "Preview: Private-only desk" [ref=f2e63] [cursor=pointer]': Preview
              - link "Edit profile" [ref=f2e64] [cursor=pointer]:
                - /url: /app/profiles/83d148f8-f06e-46c3-ba24-a5112e70380e/edit?back=%2Fapp%2Fprofiles%3Fq%3D%26filter%3Dall%26selected%3Dd7ecf193-7b9b-4723-aea5-ed6df7393486
        - paragraph [ref=f2e66]: Drafts don’t use published slots.Draft edits stay private until you publish.
      - complementary "Published preview" [ref=f2e67]:
        - heading "Published preview" [level=2] [ref=f2e68]
        - paragraph [ref=f2e69]: The last published version. Links are disabled.
        - paragraph [ref=f2e70]:
          - text: Published media desk
          - generic [ref=f2e71]: /@desk-1a99ff13
        - generic [ref=f2e72]:
          - paragraph [ref=f2e73]: Private edits are not shown here.
          - article [ref=f2e76]:
            - generic [ref=f2e79]:
              - heading "Published identity" [level=2] [ref=f2e80]
              - paragraph [ref=f2e81]: Published media biography
            - generic [ref=f2e85]:
              - generic [ref=f2e88]: Published destination
              - generic [aria-hidden] [ref=f2e89]: ↗
            - generic [ref=f2e90]: Published preview. Links are disabled.
      - status [ref=f2e91]: Published preview loaded for Published media desk
  - alert [ref=f2e92]
```