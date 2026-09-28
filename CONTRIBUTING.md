# Contributing · 贡献指南

Thanks for helping teach agents to build dsh plugins better.
感谢帮助教会 agent 更好地开发 dsh 插件。

## What's valuable · 什么最有价值

1. **Drift reports · 版本漂移报告** — dsh is pre-stable. If a template, red
   line, or API shape no longer matches your installed dsh, open an issue with
   the version and the observed behavior. This is the single most useful
   contribution.
   dsh 预稳定。模板、红线或 API 形状与你安装的 dsh 不一致时，开 issue 附上版本号与观察到的行为——这是最有价值的贡献。
2. **New templates** — follow an existing template's shape (manifest, patch,
   entry, README). It must pass `npm run validate` and avoid all 12 pitfalls.
   新模板请遵循现有模板的形状（manifest、patch、入口、README）；必须通过
   `npm run validate` 且避开全部 12 条红线。
3. **Reference improvements** — concrete beats abstract: file paths, code
   excerpts, and the "why" behind each rule.
   改进参考文档请具体：文件路径、代码摘录、每条规则背后的“为什么”。

## Ground rules · 基本规则

- Keep `SKILL.md` under 500 lines; push detail into `references/`.
  `SKILL.md` 保持 500 行以内，细节下沉到 `references/`。
- Every EN reference has a Chinese mirror in `skills/dsh-plugin-dev/zh/` —
  update both in the same PR.
  每篇英文 reference 在 `skills/dsh-plugin-dev/zh/` 有中文镜像——同一 PR 里同步更新。
- No secrets, no internal-only registry URLs, no proprietary code in examples.
  示例中不含机密、不含仅内网的 registry 地址、不含专有代码。
- Run locally before pushing: `npm install && npm run validate` and
  `cd examples/dice-tool && node --test`.
  推送前本地跑：`npm install && npm run validate` 与 `cd examples/dice-tool && node --test`。

## License

By contributing you agree your contributions are licensed under the MIT
License of this repository.
提交即表示同意你的贡献按本仓库的 MIT 许可证授权。
