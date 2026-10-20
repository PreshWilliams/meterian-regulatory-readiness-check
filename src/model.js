/* ============================================================================
   Regulatory Mapping Lead Capture Tool — DATA MODEL
   SoW PWMTR-001 · D1 v0.1 (18 Oct 2026)

   This file is the single place Meterian edits to change the tool without
   touching the interface: question wording, answer options, weights, the
   framework mapping, obligation flags and the "How Meterian helps" lines.

   Rules of the model (see D1 note, section 7):
   - Every option carries 0-3 risk points. 0 = least risk.
   - weight: 3 = determines legal exposure or is a foundational control;
             2 = material; 1 = contextual amplifier.
   - Framework / regulation selection changes mapping, wording and flags,
     never the score.

   Runs unchanged in the browser (plain script -> window.RMLC_MODEL) and in
   Node (module.exports) so the scoring can be unit-tested.
============================================================================ */

const RMLC_MODEL = (function () {
  "use strict";

  const VERSION = "0.2.0";
  const UPDATED = "2026-10-20";
  const MAX_POINTS = 3;

  /* ---------------------------------------------------------------------
     Per-answer levels (0-3 points) and overall bands (0-100 score)
  --------------------------------------------------------------------- */
  const LEVELS = {
    0: { id: "low", label: "Low" },
    1: { id: "medium", label: "Medium" },
    2: { id: "high", label: "High" },
    3: { id: "critical", label: "Critical" },
  };

  const BANDS = [
    { id: "low", label: "Low", min: 0, max: 25, rank: 0,
      guidance: "Maintain current controls and reassess on any material change to products, suppliers or regulation." },
    { id: "medium", label: "Medium", min: 26, max: 50, rank: 1,
      guidance: "Material exposure that is managed, or moderate exposure with gaps. Close the listed gaps and make sure the evidence exists." },
    { id: "high", label: "High", min: 51, max: 75, rank: 2,
      guidance: "Requires senior review and a remediation plan with dates. Prioritise the foundational controls first." },
    { id: "critical", label: "Critical", min: 76, max: 100, rank: 3,
      guidance: "Executive escalation. Foundational controls are missing against significant exposure; treat as a programme, not a ticket." },
  ];

  /* Override: a weighted average can hide a missing control behind good
     answers elsewhere. Any one Controls dimension at its weakest level floors
     the rating at High; two or more force Critical. Applies only when
     Exposure is above the Low band - if nothing is at stake, a missing control
     is a gap to record, not an emergency. Exposure answers never trigger it. */
  const OVERRIDE = {
    group: "controls",
    tripwirePoints: MAX_POINTS,
    minExposureScore: 26,
    singleFloor: "high",
    multiForce: "critical",
  };

  /* ---------------------------------------------------------------------
     Selectable frameworks, overlays and regulations
  --------------------------------------------------------------------- */
  /* short: used after the full name has appeared once on the page.
     full:  the name as it should appear on first use (and for search). */
  const FRAMEWORKS = {
    iso27001: { short: "ISO 27001", full: "ISO/IEC 27001:2022 Information Security Management", kind: "framework",
      note: "The international standard for an information security management system. Annex A controls cited unless marked cl." },
    iso42001: { short: "ISO 42001", full: "ISO/IEC 42001:2023 Artificial Intelligence Management System", kind: "framework",
      note: "The international standard for governing AI. Relevant where AI is built into products or used in development." },
    caf: { short: "NCSC CAF v4.0", full: "NCSC Cyber Assessment Framework (CAF) v4.0", kind: "framework",
      note: "The National Cyber Security Centre's outcome-based framework for operators of essential functions and the public sector; suppliers meet it through A4.",
      overlays: ["dtac"] },
    cra: { short: "EU CRA", full: "EU Cyber Resilience Act (CRA)", kind: "regulation",
      note: "Regulation (EU) 2024/2847. Obligation-based law for manufacturers of products with digital elements placed on the EU market." },
    sscop: { short: "Software Security Code", full: "UK Software Security Code of Practice (SSCoP)", kind: "code",
      note: "The UK government's voluntary code for software vendors: 14 principles in 4 themes, increasingly expected in public-sector procurement." },
  };

  const OVERLAYS = {
    dtac: { short: "DTAC", full: "NHS Digital Technology Assessment Criteria (DTAC)", parent: "caf",
      note: "The NHS assessment criteria for digital health technology. Suggested when the sector is public sector or health.",
      suggestWhen: { dimension: "sector", minPoints: 3 } },
  };

  const FRAMEWORK_ORDER = ["iso27001", "iso42001", "caf"];
  const REGULATION_ORDER = ["cra", "sscop"];

  /* Dated facts the obligation flags rely on. Review annually. */
  const KEY_DATES = {
    cra_in_force: "2024-12-10",
    cra_reporting_applies: "2026-09-11",
    cra_full_application: "2027-12-11",
    iso27001_transition_deadline: "2025-10-31",
    sscop_published: "2025-05",
  };

  /* ---------------------------------------------------------------------
     Meterian products (for the "How Meterian helps" lines and glossary)
  --------------------------------------------------------------------- */
  const PRODUCTS = {
    boss: { name: "BOSS", what: "Software Composition Analysis for codebases: open-source dependencies, direct and transitive, across 18+ languages. Reads manifests only; never your source code." },
    bossc: { name: "BOSSC", what: "Container image scanner: operating-system and application-layer vulnerabilities." },
    isaac: { name: "ISAAC", what: "Infrastructure-as-code scanner for Terraform, CloudFormation, Kubernetes/Helm and ARM/Bicep, with secrets detection." },
    sasha: { name: "SASHA", what: "Static application security testing with SARIF output." },
    heidi: { name: "HEIDI", what: "Free IDE plugin and MCP server: package-risk checks where developers and AI coding assistants add dependencies." },
    kiwi: { name: "KIWI", what: "Vulnerability data feed refreshed at least every four hours from 20+ sources; available on-premises." },
    sentinel: { name: "Sentinel", what: "Alerts on newly published vulnerabilities in components you have already shipped, without a rescan." },
    sbom: { name: "SBOM & Policies", what: "Automatic Software Bill of Materials, licence inventory and policy enforcement." },
    reports: { name: "Reports & API", what: "Per-scan reports in HTML, JSON, TXT and PDF; dashboard history; full REST API." },
    feed: { name: "JSON feed", what: "Machine-readable vulnerability and component data that feeds partner compliance and customer-communication tools." },
  };

  const DEPLOYMENT_NOTES = [
    "On-premises and air-gapped deployment of the scanners is available for public sector and CNI environments with no outbound data flow.",
    "Single sign-on (Entra ID, Google Workspace, SAML) and multi-factor authentication are available on enterprise plans.",
  ];

  /* ---------------------------------------------------------------------
     DIMENSIONS - 6 Exposure + 6 Controls
     Each option: { points, label }. mapping: per framework / overlay.
     implication (exposure) or remediation (controls): framework-neutral text
     for the report. meterian: the "How Meterian helps" line (controls only).
  --------------------------------------------------------------------- */
  const DIMENSIONS = [
    /* ============================ EXPOSURE ============================ */
    {
      id: "reg_scope", code: "E1", group: "exposure", weight: 3,
      name: "Regulatory scope of what you ship",
      question: "Which best describes the software your organisation produces or supplies?",
      measures: "Whether the software you produce falls into a regulated product category and whether you are a supplier to others.",
      why: "The single biggest determinant of legal exposure: it decides whether the CRA applies at all (fines of up to €15m or 2.5% of worldwide turnover), whether the Code of Practice is being asked of you by public-sector buyers, and whether you are the manufacturer who must produce an SBOM and report.",
      whyWeight: "Weight 3 because it sets the legal duties every other answer is measured against.",
      options: [
        { points: 0, label: "Software is used internally only; nothing is supplied to customers or other organisations" },
        { points: 1, label: "We run customer-facing services (SaaS, portals, apps) but do not distribute software products" },
        { points: 2, label: "We supply software or digital products to customers in the UK, or build software for public bodies under contract" },
        { points: 3, label: "We place products with digital elements on the EU market, or supply into the NHS, central or local government, or critical national infrastructure" },
      ],
      mapping: {
        iso27001: "cl. 4.2 interested parties and their requirements; A.5.31 legal, statutory, regulatory and contractual requirements",
        iso42001: "cl. 4.1–4.2 context and role in the AI value chain; A.10.4 customers",
        caf: "A1 Governance (scope of essential functions); A4.a supply chain (supplier flow-down)",
        dtac: "Applicability: any supplier of digital health technology to the NHS",
        cra: "Art. 2–3 scope (products with digital elements); Art. 13 manufacturer obligations; Annex III/IV product classes",
        sscop: "Scope: applies to software vendors; 4.1 information on support period",
      },
      implication: "Scope sets your legal duties. At the top level you are the manufacturer under the CRA and the vendor public-sector buyers hold to the Code of Practice. Confirm scope with counsel and list which products are in scope and from when.",
      meterian: null,
    },
    {
      id: "consequence", code: "E2", group: "exposure", weight: 3,
      name: "Consequence of a supply-chain compromise",
      question: "If a vulnerable component in your software were exploited, what is the worst realistic outcome?",
      measures: "The worst realistic outcome if a vulnerable component in your software is exploited.",
      why: "Impact is half of every risk equation and is what turns a CVE into a board matter. A single unpatched framework exposed 147 million records at Equifax; the 2025 JLR incident was modelled at £1.9bn of UK economic impact.",
      whyWeight: "Weight 3 because the same gap is a different risk when patients, payments or essential services are on the other side of it.",
      options: [
        { points: 0, label: "Inconvenience; no customer, financial or regulatory impact" },
        { points: 1, label: "Business disruption, rework or contained financial loss" },
        { points: 2, label: "Personal data breach, service outage affecting customers, or a reportable incident" },
        { points: 3, label: "Patient safety, an essential public service, payment or financial systems, or systemic harm to third parties" },
      ],
      mapping: {
        iso27001: "cl. 6.1.2 risk assessment (consequences); A.5.12 classification of information",
        iso42001: "cl. 6.1.2 AI risk assessment; A.5 AI system impact assessment",
        caf: "A2.a risk management process; A2.b understanding threat (attacker-path analysis)",
        dtac: "Section A clinical safety (DCB0129 / DCB0160)",
        cra: "Art. 13(2) cybersecurity risk assessment; Annex I Part I(1) appropriate level of cybersecurity based on risk",
        sscop: "1.1 established secure development framework, proportionate to risk",
      },
      implication: "Size every control to the worst realistic outcome: remediation SLAs, monitoring coverage and evidence retention should be proportionate to it, and the risk assessment should record it.",
      meterian: null,
    },
    {
      id: "oss_reliance", code: "E3", group: "exposure", weight: 2,
      name: "Open-source dependency reliance",
      question: "How much of the software you ship is built from open-source or third-party components, whether developed in-house or by suppliers?",
      measures: "How much of what you ship you did not write.",
      why: "Up to 90% of a modern application is open source, and each package brings others with it. Inherited code carries your liability, your licence obligations and your reporting duties.",
      whyWeight: "Weight 2 because inherited code is the attack surface this whole category exists for, but a surface is not a failure.",
      options: [
        { points: 0, label: "Minimal third-party code; a few applications, mostly written in-house" },
        { points: 1, label: "Open-source libraries in some applications, one main language or ecosystem" },
        { points: 2, label: "Open-source across most applications in several ecosystems" },
        { points: 3, label: "Open-source is the majority of what we ship across a large estate, including code developed by external suppliers" },
      ],
      mapping: {
        iso27001: "A.5.21 managing information security in the ICT supply chain; A.8.30 outsourced development",
        iso42001: "A.4.4 tooling resources; A.10.3 suppliers",
        caf: "A4.a supply chain; A3.a asset management",
        dtac: null,
        cra: "Art. 13(5) due diligence on third-party and open-source components",
        sscop: "1.2 understand the composition of the software and assess third-party component risk",
      },
      implication: "The code you did not write still carries your liability. Inventory it, monitor it and hold suppliers to the same standard as your own teams.",
      meterian: null,
    },
    {
      id: "ai_dev", code: "E4", group: "exposure", weight: 2,
      name: "AI-assisted development",
      question: "How are AI coding assistants or agents used in your software development?",
      measures: "How much code and how many dependencies enter your software through AI coding assistants or agents, and with how much human review.",
      why: "Assistants recommend packages from training data that may be years old; agents can install them, run commands and use credentials. An agent with those permissions is a privileged operator inside your environment, and privileged operators need controls.",
      whyWeight: "Weight 2 because it amplifies open-source reliance rather than standing alone, and it is the bridge to ISO 42001.",
      options: [
        { points: 0, label: "No AI coding assistants in use" },
        { points: 1, label: "Some developers use assistants; all changes go through human code review" },
        { points: 2, label: "Widespread use; assistants routinely suggest and add packages, reviewed only at merge" },
        { points: 3, label: "Coding agents can add packages, run commands or use credentials with limited human review" },
      ],
      mapping: {
        iso27001: "A.8.25 secure development life cycle; A.8.28 secure coding; A.6.3 awareness and training",
        iso42001: "A.9.2–A.9.3 processes and objectives for responsible use of AI systems; A.4.4 tooling resources; A.4.6 competence",
        caf: "A4.b secure software development and support; A2.b understanding threat; B6 staff awareness",
        dtac: null,
        cra: "Annex I Part I(1)–(2) secure development; no known exploitable vulnerabilities at delivery",
        sscop: "1.1, 1.2; 2.1 build-environment access (agents holding credentials)",
      },
      implication: "Treat AI coding assistants and agents as privileged operators: least privilege, no production credentials, package-risk checks at the point of suggestion, and human review before merge.",
      meterian: null,
    },
    {
      id: "deploy_surface", code: "E5", group: "exposure", weight: 2,
      name: "Deployment surface",
      question: "How is your software deployed and its infrastructure defined?",
      measures: "Where and how software is deployed: containers, infrastructure-as-code, cloud, build-pipeline secrets.",
      why: "Each layer is its own supply chain: container base images carry their own vulnerabilities, infrastructure code carries misconfiguration, and pipelines carry credentials. Secure-by-default obligations apply to all of them.",
      whyWeight: "Weight 2 because a modern deployment surface multiplies the places a known weakness can sit, without being a failure in itself.",
      options: [
        { points: 0, label: "Traditional on-premises deployment; no containers or infrastructure-as-code" },
        { points: 1, label: "Some cloud hosting; configuration managed manually" },
        { points: 2, label: "Containers in production and some infrastructure-as-code (Terraform, Kubernetes/Helm, CloudFormation)" },
        { points: 3, label: "Containerised, multi-cloud estate defined largely in code, with secrets and credentials handled in build pipelines" },
      ],
      mapping: {
        iso27001: "A.8.9 configuration management; A.5.23 information security for use of cloud services; A.8.31 separation of environments",
        iso42001: "A.4.5 system and computing resources; A.6.2.5 AI system deployment",
        caf: "B4.a secure by design; B4.b secure configuration",
        dtac: "Section C2 technical security (hosting, penetration testing)",
        cra: "Annex I Part I(2)(a) secure by default configuration; (2)(i) limit attack surfaces",
        sscop: "1.4 secure by design and default; 2.1–2.2 build environment; 3.1 secure distribution",
      },
      implication: "Scan base images and infrastructure code with the same discipline as application dependencies, detect secrets in pipelines, and enforce secure-by-default configuration.",
      meterian: null,
    },
    {
      id: "sector", code: "E6", group: "exposure", weight: 1, contextual: true,
      name: "Sector and regulatory scrutiny",
      question: "Which sector best describes your organisation or your principal customers?",
      measures: "The regulatory attention your sector attracts. Also the segmentation field for follow-up.",
      why: "Regulators and buyers set the evidence bar: a council, an NHS trust or a bank is asked for more, more often, than a general commercial business.",
      whyWeight: "Weight 1 because sector amplifies everything else but is not itself a failure; it is excluded from the override for the same reason.",
      options: [
        { points: 0, label: "General commercial; no sector regulator", segment: "commercial" },
        { points: 1, label: "Consumer or retail: GDPR and PCI DSS exposure", segment: "retail" },
        { points: 2, label: "Financial services or fintech: FCA, DORA, PCI DSS", segment: "fintech" },
        { points: 3, label: "Public sector, NHS or health tech, CNI or defence: CAF, DTAC and Code of Practice expectations", segment: "public_sector_health" },
      ],
      mapping: {
        iso27001: "cl. 4.1 understanding the organisation and its context; A.5.31",
        iso42001: "cl. 4.1 context; A.5.4 assessing impacts on individuals and society",
        caf: "Applicability: NIS-regulated operators and public-sector CAF profiles",
        dtac: "Health overlay trigger",
        cra: "Annex III/IV important and critical product classes",
        sscop: "Public-sector procurement expectation",
      },
      implication: "Align the frameworks you report against with what your procurement, audit and regulatory stakeholders actually ask for, and keep the evidence in the form they accept.",
      meterian: null,
    },

    /* ============================ CONTROLS ============================ */
    {
      id: "inventory", code: "C1", group: "controls", weight: 3,
      name: "Component inventory (SBOM)",
      question: "Do you know what is in the software you ship?",
      measures: "Whether a current, machine-readable inventory of third-party components exists, including container images and licence terms.",
      why: "Inventory is the precondition for every other control, the CRA's explicit requirement from 11 December 2027, and what makes 24/72-hour reporting possible at all. Licence terms belong in it, which is where the open-source IP question is answered.",
      whyWeight: "Weight 3 because nothing else can be monitored, fixed or evidenced for a component you do not know you have.",
      options: [
        { points: 0, label: "Machine-readable SBOM (CycloneDX or SPDX) with licence terms, generated automatically for every build, covering application dependencies and container images, kept current through the support period" },
        { points: 1, label: "Automated SBOM for application code on most projects; not updated between releases" },
        { points: 2, label: "Partial or manually maintained component lists for some applications" },
        { points: 3, label: "No inventory of third-party components" },
      ],
      mapping: {
        iso27001: "A.5.9 inventory of information and other associated assets; A.5.32 intellectual property rights",
        iso42001: "A.4.2 resource documentation; A.6.2.7 AI system technical documentation",
        caf: "A3.a asset management; A4.b secure software development and support",
        dtac: null,
        cra: "Annex I Part II(1) machine-readable SBOM covering at least top-level dependencies; Annex VII technical documentation",
        sscop: "1.2 understand the composition of the software",
      },
      remediation: "Generate a machine-readable SBOM (CycloneDX or SPDX) automatically in the build for every application and container image, include licence data, store it with the release, and refresh it through the support period. Name an owner for the inventory.",
      meterian: {
        summary: "Meterian generates a Software Bill of Materials automatically from every scan, covering application dependencies (BOSS) and container images (BOSSC), with a licence inventory and policy checks, so the inventory keeps itself current with each build.",
        products: ["boss", "bossc", "sbom"],
        partial: false,
        confirm: "SBOM generation and licence risk analysis are listed as add-on features; confirm plan wording with Meterian.",
      },
    },
    {
      id: "guardrails", code: "C2", group: "controls", weight: 2,
      name: "Pre-production guardrails",
      question: "Can a known-vulnerable component reach production unchallenged?",
      measures: "Whether automated checks stop known-vulnerable or non-compliant components before release, and how early they run.",
      why: "A gate in the pipeline is the cheapest place to stop a known weakness, and a check at the developer's desk is cheaper still, including when an AI assistant made the suggestion.",
      whyWeight: "Weight 2 because gating only catches what is known at build time; monitoring and remediation matter more across the product's life.",
      options: [
        { points: 0, label: "Blocking gates in CI across code, container images and infrastructure code (including secrets), plus checks at the developer's desk before a dependency is added, including when an AI assistant suggests it" },
        { points: 1, label: "CI pipeline blocks builds that breach a security threshold for dependencies" },
        { points: 2, label: "Scans run but are advisory; findings do not stop a release" },
        { points: 3, label: "No automated checks before release" },
      ],
      mapping: {
        iso27001: "A.8.25 secure development life cycle; A.8.28 secure coding; A.8.29 security testing in development and acceptance; A.8.31 separation of environments; A.8.4 access to source code",
        iso42001: "A.6.2.4 AI system verification and validation; A.9.2 responsible use of AI tooling",
        caf: "B4.a secure by design; B4.c secure management; A4.b secure software development and support",
        dtac: "Section C2: OWASP Top 10 and penetration-test expectations",
        cra: "Annex I Part I(2) no known exploitable vulnerabilities at delivery; Part II(3) effective and regular tests and reviews",
        sscop: "1.3 testing before distribution; 1.4 secure by design and default; 2.1 protect the build environment; 2.2 control and log changes to it",
      },
      remediation: "Set a security threshold in CI that blocks builds introducing known-vulnerable dependencies, extend the gate to container images and infrastructure code with secrets detection, and move the first check to the developer's desk, including dependencies suggested by AI assistants, so findings arrive before the pull request rather than after release.",
      meterian: {
        summary: "Meterian's CI integration blocks a build whose security, stability or licensing score falls below the threshold you set. ISAAC checks infrastructure and build-environment code and detects leaked secrets, SASHA adds static analysis, and HEIDI brings package-risk checks into the IDE and gives AI coding assistants live vulnerability context through Meterian's MCP server tools, free of charge.",
        products: ["boss", "isaac", "sasha", "heidi"],
        partial: false,
        confirm: "Meterian's SSCoP mapping cites 'SSCoP MCP Server Tools' against principle 1.4; confirm the product name to use.",
      },
    },
    {
      id: "monitoring", code: "C3", group: "controls", weight: 3,
      name: "Continuous monitoring after release",
      question: "How do you learn that a component you already shipped has a new vulnerability?",
      measures: "Whether shipped components are watched continuously for newly published vulnerabilities, including transitive and unmaintained ones.",
      why: "Most exploited vulnerabilities are disclosed after the code shipped. A release-only scan is blind for the whole support period the CRA and the Code require you to cover.",
      whyWeight: "Weight 3 because the window between disclosure and exploitation is measured in days, and a scan at the last release cannot see it.",
      options: [
        { points: 0, label: "Continuous monitoring with alerts when a new vulnerability is published, without rescanning, covering transitive dependencies and unmaintained components" },
        { points: 1, label: "Automated rescan at each release only" },
        { points: 2, label: "Periodic manual review or annual penetration test" },
        { points: 3, label: "None; we would hear about it from a customer or the news" },
      ],
      mapping: {
        iso27001: "A.8.8 management of technical vulnerabilities; A.8.16 monitoring activities; A.5.7 threat intelligence",
        iso42001: "A.6.2.6 AI system operation and monitoring; A.6.2.8 recording of event logs",
        caf: "B4.d vulnerability management; C1.a monitoring coverage; C2 threat hunting (partial)",
        dtac: "Section C2 vulnerability management",
        cra: "Art. 13 vulnerability handling through the support period; Annex I Part II(2)–(3)",
        sscop: "3.3 proactive detection and management of vulnerabilities in software and third-party components",
      },
      remediation: "Subscribe shipped components to continuous vulnerability monitoring so a newly published CVE raises an alert without a rescan; cover transitive dependencies and flag unmaintained components; route alerts to a named owner with a triage SLA.",
      meterian: {
        summary: "Sentinel alerts you when a new vulnerability is published for a component you have already shipped, without a rescan, across application dependencies (BOSS) and container images (BOSSC). The Meterian vulnerability database is refreshed at least every four hours from 20+ sources and flags unmaintained components and transitive exposure.",
        products: ["sentinel", "kiwi", "boss", "bossc"],
        partial: false,
        confirm: "Sentinel notifications are listed as an add-on feature; confirm plan wording with Meterian.",
      },
    },
    {
      id: "remediation", code: "C4", group: "controls", weight: 3,
      name: "Remediation and exception management",
      question: "When a vulnerability is found, how fast is it fixed, and what happens when it cannot be?",
      measures: "Whether remediation runs to measured, severity-based deadlines and whether exceptions are governed.",
      why: "Detection without remediation is a longer risk register. The CRA's \"without delay\" and fixed timelines turn SLAs into legal exposure; best effort will not satisfy a regulator or an auditor.",
      whyWeight: "Weight 3 because the fix, not the finding, is what reduces risk, and the exception register is what makes an unfixable finding defensible.",
      options: [
        { points: 0, label: "Severity-based SLAs enforced and measured; automated upgrade or fix pull requests; exceptions documented with owner, rationale and expiry" },
        { points: 1, label: "Defined SLAs by severity, tracked manually; exceptions informal" },
        { points: 2, label: "Best-effort fixes with no targets" },
        { points: 3, label: "No defined remediation process" },
      ],
      mapping: {
        iso27001: "A.8.8 management of technical vulnerabilities; A.8.32 change management; cl. 6.1.3 risk treatment (exceptions as accepted risk)",
        iso42001: "A.6.2.6 operation and monitoring; cl. 6.1.3 AI risk treatment",
        caf: "B4.d vulnerability management; A2.a risk decisions",
        dtac: "Section C2 patching timescales",
        cra: "Annex I Part II(2) remediate without delay; (7) secure distribution of updates; (8) patches without delay and free of charge; Art. 13 security updates",
        sscop: "3.5 timely security updates and notifications; 3.1 secure distribution",
      },
      remediation: "Define severity-based remediation SLAs and measure against them, automate upgrade pull requests where possible, and run a documented exception register with owner, rationale, compensating control and expiry date.",
      meterian: {
        summary: "Reports show the upgrade path for each affected component, autofix raises pull requests on supported platforms, exclusions are recorded against the scan, and HEIDI suggests safer versions while the dependency is being added.",
        products: ["boss", "heidi"],
        partial: false,
        confirm: "Automatic remediation and pull requests are available on selected platforms and languages; confirm the supported list.",
      },
    },
    {
      id: "disclosure", code: "C5", group: "controls", weight: 2,
      name: "Vulnerability disclosure and reporting readiness",
      question: "Could you meet a 24/72-hour reporting clock, and is there a published way for researchers to reach you?",
      measures: "Whether a coordinated vulnerability disclosure route exists and whether the incident process can identify affected products fast enough to report on time.",
      why: "CRA Article 14 reporting has applied since 11 September 2026; both the CRA and the Code require a coordinated disclosure policy. The hard part of reporting is not the form but knowing which products contain the affected component.",
      whyWeight: "Weight 2 because the clock is real and already running, but the control depends on the inventory and monitoring above it.",
      options: [
        { points: 0, label: "Published CVD policy and security.txt; rehearsed incident process meeting 24/72-hour timelines; affected products identifiable within hours from the inventory" },
        { points: 1, label: "Published CVD policy and incident process, but identifying affected products takes days" },
        { points: 2, label: "A security contact exists; no policy, no tested process" },
        { points: 3, label: "No disclosure route and no incident reporting process" },
      ],
      mapping: {
        iso27001: "A.5.24–A.5.28 incident management; A.5.5 contact with authorities; A.5.6 contact with special interest groups",
        iso42001: "A.8.4 communication of incidents; A.8.3 external reporting",
        caf: "D1.a–c response and recovery planning and capability; D2.a lessons learned",
        dtac: "Section C2 incident reporting; Data Security and Protection Toolkit",
        cra: "Art. 14 reporting (24-hour early warning, 72-hour notification, 14-day report; in force since 11 September 2026); Annex I Part II(4)–(6) disclosure of fixed vulnerabilities, CVD policy, contact address",
        sscop: "3.2 vulnerability disclosure process; 3.4 report vulnerabilities to relevant parties; 4.3 inform customers of incidents",
      },
      remediation: "Publish a coordinated vulnerability disclosure policy and a security.txt file, rehearse the incident process against the 24-hour / 72-hour / 14-day CRA timeline, and prove you can identify every affected product from the inventory within hours.",
      meterian: {
        summary: "Meterian does not write your disclosure policy or file your reports, but it answers the question the clock depends on: which products contain the affected component. The SBOM and Sentinel alerts give that answer in hours rather than days, BOSS reports vulnerabilities to your team automatically, and the JSON feed carries the same data into the compliance or customer-communication tools that run your disclosure process.",
        products: ["sbom", "sentinel", "feed"],
        partial: true,
        confirm: "Meterian's SSCoP mapping places principles 3.1, 3.2 and 4.1–4.3 with partner tools via the JSON feed; confirm how to name those partners, if at all.",
      },
    },
    {
      id: "evidence", code: "C6", group: "controls", weight: 2,
      name: "Audit evidence and assurance reporting",
      question: "Could you prove all of the above to an auditor, a regulator or a customer's procurement team this week?",
      measures: "Whether control activity leaves retained, shareable evidence in a form auditors, customers and regulators accept.",
      why: "CAF is assessed on evidence, ISO on documented information, the CRA on technical documentation retained for years. Security data is becoming legal evidence, financial assurance and proof of operational control.",
      whyWeight: "Weight 2 because evidence does not reduce the likelihood of a breach, but its absence turns a managed risk into a failed audit or a lost tender.",
      options: [
        { points: 0, label: "Automated per-build reports (PDF, JSON, SARIF) retained and shareable; feed directly into the ISMS or CAF evidence base" },
        { points: 1, label: "Periodic reports compiled manually for audits" },
        { points: 2, label: "Ad-hoc screenshots and spreadsheets when asked" },
        { points: 3, label: "Nothing documented" },
      ],
      mapping: {
        iso27001: "cl. 7.5 documented information; cl. 9.1 monitoring, measurement, analysis and evaluation; cl. 9.2 internal audit; A.5.36 compliance with policies, rules and standards",
        iso42001: "cl. 7.5, 9.1–9.2; A.6.2.7 technical documentation; A.8.2–A.8.3 information for interested parties",
        caf: "Evidence-based self-assessment of every contributing outcome; A1.b roles and responsibilities; A2.a",
        dtac: "Evidence-based self-assessment submission",
        cra: "Annex VII technical documentation; Art. 13 documentation retention; conformity assessment (Art. 32) and EU declaration of conformity",
        sscop: "4.1–4.2 information to customers; self-attestation against the Code",
      },
      remediation: "Retain per-build scan reports and SBOMs as records, export them in formats auditors and customers accept, and index them to the relevant ISO, CAF or CRA requirement so evidence is retrievable on request.",
      meterian: {
        summary: "Every scan produces a retained report in HTML, JSON, TXT or PDF (SARIF from SASHA), with dashboard history and full API access, and the JSON feed passes the same evidence into partner compliance tools, so audit evidence is a by-product of the pipeline rather than a quarterly exercise.",
        products: ["reports", "sasha", "feed"],
        partial: false,
        confirm: "Some report formats are limited to enterprise plans; confirm wording.",
      },
    },
  ];

  /* ---------------------------------------------------------------------
     OBLIGATION FLAGS - regulation-specific notes with dates, triggered by
     Exposure answers and the user's selections, cross-referenced to the
     Controls answers so the report can say "this applies to you; here is
     where you stand".
     when:     { dimension, minPoints }  - all conditions must hold
     requires: any one of these selections (framework/regulation/overlay ids)
     crossRef: Controls dimensions whose answer the flag reports against
  --------------------------------------------------------------------- */
  const OBLIGATION_FLAGS = [
    {
      id: "cra_reporting", requires: ["cra"], when: [{ dimension: "reg_scope", minPoints: 2 }],
      title: "CRA Article 14 reporting is already in force",
      text: "Since 11 September 2026, manufacturers must notify ENISA and the national CSIRT of actively exploited vulnerabilities and severe incidents: early warning within 24 hours, notification within 72 hours, final report within 14 days. Meeting the clock depends on knowing which products contain the affected component.",
      date: KEY_DATES.cra_reporting_applies, crossRef: ["disclosure", "inventory"],
    },
    {
      id: "cra_sbom", requires: ["cra"], when: [{ dimension: "reg_scope", minPoints: 2 }],
      title: "Machine-readable SBOM mandatory from 11 December 2027",
      text: "From full application of the CRA, products with digital elements must be accompanied by a machine-readable SBOM covering at least top-level dependencies (Annex I Part II(1)), held in the technical documentation and provided to market surveillance authorities on request. It must be maintained across the support period, not produced once.",
      date: KEY_DATES.cra_full_application, crossRef: ["inventory"],
    },
    {
      id: "cra_updates", requires: ["cra"], when: [{ dimension: "reg_scope", minPoints: 2 }],
      title: "Vulnerabilities must be remediated without delay through the support period",
      text: "The CRA requires manufacturers to address and remediate vulnerabilities without delay, distribute security updates securely and free of charge, and keep doing so for a support period of at least five years (Art. 13; Annex I Part II(2), (7), (8)).",
      date: KEY_DATES.cra_full_application, crossRef: ["monitoring", "remediation"],
    },
    {
      id: "cra_cvd", requires: ["cra"], when: [{ dimension: "reg_scope", minPoints: 2 }],
      title: "A coordinated vulnerability disclosure policy is required",
      text: "Annex I Part II(5)–(6) require a published coordinated vulnerability disclosure policy and a contact address for reporting vulnerabilities, and Part II(4) requires public disclosure of fixed vulnerabilities once an update is available.",
      date: KEY_DATES.cra_full_application, crossRef: ["disclosure"],
    },
    {
      id: "cra_docs", requires: ["cra"], when: [{ dimension: "reg_scope", minPoints: 2 }],
      title: "Technical documentation must be retained and producible",
      text: "Annex VII technical documentation, including the SBOM and the vulnerability-handling evidence, must be kept for ten years after the product is placed on the market or for the support period, whichever is longer, and produced to authorities on request. Fines reach €15m or 2.5% of worldwide turnover (Art. 64).",
      date: KEY_DATES.cra_full_application, crossRef: ["evidence"],
    },
    {
      id: "sscop_composition", requires: ["sscop"], when: [{ dimension: "reg_scope", minPoints: 2 }],
      title: "Code of Practice: know the composition of your software",
      text: "Principle 1.2 expects vendors to understand the composition of their software and assess the risks of third-party components; 3.3 expects proactive detection and management of vulnerabilities in those components; 3.5 expects timely security updates.",
      date: null, crossRef: ["inventory", "monitoring", "remediation"],
    },
    {
      id: "sscop_build_env", requires: ["sscop"], when: [{ dimension: "reg_scope", minPoints: 2 }, { dimension: "deploy_surface", minPoints: 2 }],
      title: "Code of Practice Theme 2: protect the build environment",
      text: "Principle 2.1 expects the build environment to be protected against unauthorised access and 2.2 expects changes to it to be controlled and logged. Infrastructure defined in code and credentials handled in pipelines bring both principles into scope.",
      date: null, crossRef: ["guardrails"],
    },
    {
      id: "sscop_cvd", requires: ["sscop"], when: [{ dimension: "reg_scope", minPoints: 2 }],
      title: "Code of Practice: a published vulnerability disclosure process",
      text: "Principle 3.2 expects an effective, published vulnerability disclosure process; 3.4 expects vulnerabilities to be reported to relevant parties; 4.3 expects customers to be told about security incidents that affect them in a timely manner.",
      date: null, crossRef: ["disclosure"],
    },
    {
      id: "sscop_procurement", requires: ["sscop"], when: [{ dimension: "sector", minPoints: 3 }],
      title: "Public-sector buyers increasingly ask suppliers to attest against the Code",
      text: "Central and local government and NHS procurement is adopting the Code as the baseline it asks software suppliers to self-attest against. Evidence that the controls operate, not just a policy, is what the attestation rests on.",
      date: null, crossRef: ["evidence"],
    },
    {
      id: "caf_a4b", requires: ["caf"], when: [{ dimension: "sector", minPoints: 2 }],
      title: "CAF v4.0: secure software development and support (A4.b)",
      text: "CAF v4.0 adds an explicit expectation that software is developed and supported securely, in line with SBOMs and attestable updates, treating provenance and update integrity as non-negotiable for essential functions.",
      date: null, crossRef: ["inventory", "guardrails"],
    },
    {
      id: "caf_c2", requires: ["caf"], when: [{ dimension: "sector", minPoints: 2 }],
      title: "CAF v4.0: vulnerability management and threat hunting (B4.d, C2)",
      text: "B4.d expects vulnerabilities in systems supporting essential functions to be identified and managed within defined timescales; the new C2 principle expects proactive, intelligence-led discovery whose findings are converted into detections.",
      date: null, crossRef: ["monitoring", "remediation"],
    },
    {
      id: "dtac_overlay", requires: ["dtac"], when: [{ dimension: "sector", minPoints: 3 }],
      title: "DTAC: technical security and clinical safety evidence",
      text: "Digital health technology supplied to the NHS is assessed against DTAC, including Section A clinical safety and Section C2 technical security (penetration testing, OWASP Top 10 protection, vulnerability and patch management). The evidence is submitted, not asserted.",
      date: null, crossRef: ["guardrails", "monitoring", "evidence"],
    },
    {
      id: "iso27001_2022", requires: ["iso27001"], when: [],
      title: "ISO 27001:2022 controls now apply to every certificate",
      text: "Certificates against the 2013 edition expired on 31 October 2025. The 2022 Annex A includes A.8.8 technical vulnerabilities, A.8.25 secure development life cycle, A.5.9 asset inventory and A.5.21 ICT supply chain, all of which an auditor will ask for operating evidence of.",
      date: KEY_DATES.iso27001_transition_deadline, crossRef: ["inventory", "monitoring", "guardrails", "evidence"],
    },
    {
      id: "iso42001_tooling", requires: ["iso42001"], when: [{ dimension: "ai_dev", minPoints: 1 }],
      title: "ISO 42001: AI coding tools are AI systems in use",
      text: "Under ISO 42001 the organisation's use of AI systems, including coding assistants and agents, falls within A.9 (responsible use) and A.4.4 (tooling resources). Document the tooling, its permitted scope and the guardrails around the dependencies it introduces.",
      date: null, crossRef: ["guardrails"],
    },
  ];

  /* ---------------------------------------------------------------------
     Disclaimer and methodology text (shown in-tool and in the report)
  --------------------------------------------------------------------- */
  const DISCLAIMER = "This tool is a sales-enablement and educational asset provided by Meterian. It gives an indicative, self-reported view of software supply-chain risk and the framework obligations it may engage. It is not a legal, regulatory, audit or certification assessment, does not establish compliance with any framework or regulation, and should not be relied on as legal advice. Framework references are indicative summaries, not authoritative clause mappings.";

  const METHODOLOGY = "Each answer carries 0 to 3 risk points. Section score = sum(points × weight) ÷ (3 × total weight) × 100, for Exposure and for Controls separately. The overall score is the average of the two section scores before rounding, so each half counts equally regardless of question count. Bands: 0–25 Low, 26–50 Medium, 51–75 High, 76–100 Critical. Override: any one Controls dimension at its weakest level floors the rating at High, and two or more force Critical; this applies only when Exposure is above the Low band. Framework and regulation selection changes the mapping, wording and obligation flags, not the score.";

  return {
    VERSION, UPDATED, MAX_POINTS, LEVELS, BANDS, OVERRIDE,
    FRAMEWORKS, OVERLAYS, FRAMEWORK_ORDER, REGULATION_ORDER, KEY_DATES,
    PRODUCTS, DEPLOYMENT_NOTES, DIMENSIONS, OBLIGATION_FLAGS,
    DISCLAIMER, METHODOLOGY,
  };
})();

if (typeof module !== "undefined" && module.exports) module.exports = RMLC_MODEL;
if (typeof window !== "undefined") window.RMLC_MODEL = RMLC_MODEL;
