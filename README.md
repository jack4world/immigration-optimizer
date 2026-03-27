# immigration-optimizer

Canadian immigration is overwhelming: Express Entry, Provincial Nominee Programs, CRS scores, NOC codes, credential assessments, language tests — hundreds of moving parts across dozens of programs. Most people spend months researching, or pay $5,000+ to consultants who still miss optimal pathways.

**immigration-optimizer** autonomously optimizes Canadian immigration pathways using the autoresearch pattern — an AI-powered CLI that analyzes your profile, calculates CRS scores, checks eligibility across 19+ programs, and iteratively improves your pathway to Permanent Residency.

支持 **English** 和 **中文（简体中文）** — 在初始化时选择语言，整个体验随之适配：提示语、生成的路径规划、研究搜索、评分系统全部使用您选择的语言。

## Install

```bash
npm install -g immigration-optimizer
```

Or run directly:

```bash
npx immigration-optimizer
```

## Quick Start

```bash
immigration-optimizer init "my-pathway"
cd my-pathway
immigration-optimizer run                # agent mode (default, interactive Claude Code)
immigration-optimizer run --standalone   # direct API calls
immigration-optimizer run --headless     # agent mode, non-interactive
immigration-optimizer run --headless --yolo --max-iterations 100
immigration-optimizer dashboard --watch
immigration-optimizer pdf                # export pathway as formatted PDF
```

## Commands

| Command | Description |
|---------|-------------|
| `init <name>` | Create a new immigration pathway project |
| `config` | Manage API keys and settings |
| `profile` | View applicant profile and CRS estimate |
| `score` | One-off absolute scoring of current pathway |
| `research` | Research immigration programs (province-by-province) |
| `run` | Start optimization loop (agent mode, safe by default) |
| `run --standalone` | Optimization via direct API calls |
| `run --headless` | Agent mode, non-interactive |
| `run --yolo` | Skip permission prompts (dangerously-skip-permissions) |
| `run --max-iterations <n>` | Limit optimization iterations (default: 50) |
| `status` | Show current score and progress |
| `dashboard` | Live optimization dashboard with sparklines |
| `chart` | ASCII score progression chart |
| `pdf` | Export pathway.md as a formatted PDF |

## How It Works

Immigration-optimizer follows the **autoresearch pattern**: it autonomously researches programs, generates pathway mutations, scores results, and keeps only improvements. Each optimization iteration proposes a targeted change — swapping a program, reordering steps, adding parallel activities, switching provinces — then evaluates whether the change improved the overall pathway. Bad mutations are discarded; good ones accumulate.

### CRS Calculator

A built-in CRS (Comprehensive Ranking System) calculator computes your Express Entry score based on age, education, language (IELTS/CELPIP/TEF/TCF), work experience, and additional factors. It identifies the highest-ROI improvement strategies for your specific profile.

### Eligibility Checker

Every program in the database is checked against your profile: language levels, education, work experience, NOC code, settlement funds, and special requirements. Programs are classified as eligible, close (within 1 CLB level), or ineligible.

### Scoring Pipeline

Scoring uses a **5-dimension + reward/penalty** system:

1. **Success probability** (w=0.30) — CRS competitiveness, eligibility match, approval rates
2. **Timeline efficiency** (w=0.25) — total duration, critical path optimization, parallelization
3. **Cost efficiency** (w=0.15) — total cost, cost-risk ratio
4. **Quality of life** (w=0.15) — destination match, career continuity
5. **Plan robustness** (w=0.15) — backup options, policy sensitivity

An adversarial critic applies penalties for concrete flaws (ineligible programs, expired credentials, missing costs) and rewards for strengths (multiple backup paths, optimal parallelization).

### Mutation Types

| Mutation | Description |
|----------|-------------|
| `SWAP_PROGRAM` | Replace a program with a better-fit alternative |
| `ADD_CREDENTIAL` | Add language test, ECA, or certification to boost CRS |
| `REORDER_STEPS` | Fix dependencies, move steps earlier |
| `ADD_PARALLEL` | Run independent steps concurrently |
| `SWITCH_PROVINCE` | Try a different province's PNP |
| `RESEARCH` | Search for new programs (triggered after 5+ discards) |

### Agent Mode

The optimizer can run as a **Claude Code agent** that autonomously reads your profile, researches programs via web search, and runs the optimization loop — committing each mutation to git so you can review the full history.

- **Safe mode** (default): Claude Code prompts for permission on each action
- **Yolo mode** (`--yolo`): skips all permission prompts for unattended operation
- **Headless mode** (`--headless`): non-interactive, suitable for background runs
- **Max iterations** (`--max-iterations N`): prevents runaway agents (default: 50)

### Web Search Integration

Configure a search API for real-time program verification:

```bash
immigration-optimizer config set search_api.provider tavily
immigration-optimizer config set search_api.api_key <key>
```

Supports **Tavily**, **Serper**, and **Brave Search** APIs. The agent uses web search to verify program requirements, check latest draw scores, and discover new pilot programs.

### 语言与本地化

`init` 的第一个问题是语言选择。选择 **中文** 后：

- 所有命令行提示和消息以中文显示
- 生成的路径规划、评分标准均以简体中文撰写
- 研究优先使用中文关键词和平台
- PDF 输出正确渲染中文内容（使用 PingFang SC / Noto Sans CJK SC 字体）

### Custom Model Support

During `init`, you can optionally configure a custom LLM instead of the default Anthropic/Vertex provider. Any OpenAI-compatible API works — Kimi (Moonshot), DeepSeek, and others. Custom models run in `--standalone` mode; agent mode always uses Claude Code.

## Seed Programs (19+)

The optimizer ships with a curated database of Canadian immigration programs:

- **Express Entry**: Federal Skilled Worker, Canadian Experience Class, Federal Skilled Trades
- **Provincial Nominee Programs**: Ontario (HCP, French-Speaking), BC (Tech, Skilled Worker), Alberta (EE, Opportunity), Saskatchewan (SINP EE, Occupation In-Demand), Manitoba (Skilled Worker, EE)
- **Quebec**: Regular Skilled Worker, Experience (PEQ), Business Investor, Self-Employed
- **Other Federal**: Atlantic Immigration, Startup Visa, Rural & Northern Pilot

Programs include eligibility requirements, processing times, fees, success rates, and historical CRS cutoffs.

## Requirements

- Node.js 22+
- One of:
  - Anthropic API key (via `immigration-optimizer config` or `ANTHROPIC_API_KEY`)
  - Google Cloud Vertex AI (`CLAUDE_CODE_USE_VERTEX=1` + `GOOGLE_CLOUD_PROJECT`)
  - Custom OpenAI-compatible API (configured during `init`)
- For agent mode: [Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)
- For PDF export: Chromium (installed automatically by Puppeteer)

## License

MIT
