/** Built-in UI copy only. Both the app slug and exact upstream text must match. */
export const APP_DEFINITION_COPY: Record<string, Record<string, string>> = {
  "cognee": {
    "Add/process knowledge and manage authorized datasets. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.cogneeKey",
  },
  "browser-use-cloud": {
    "Create/stop browser sessions and run browser tasks under the API key. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.browserKey",
    "Delegate browser tasks and watch them live in Paperclip.": "oct5Metadata.browserDescription",
    "Use credentials from your provider account.": "oct5Metadata.providerCredentials",
    "Create an API key in [Browser Use settings](https://cloud.browser-use.com/settings) and paste it below. Your agents can browse websites while you watch and interact from the task's Browser tab.": "oct5Metadata.browserGuidance",
    "API key": "localizationApps.metadata7",
  },
  "github-code-review-bot": {
    "Have an agent review pull requests and respond to GitHub mentions.": "oct5Apps.copy060",
    "Chat with an agent": "communityPhoton.metadataMethod",
    "Let people in GitHub start and continue work with one Paperclip agent.": "oct5Metadata.githubAgentChat",
    "GitHub App ID": "chatUi.chatEndpointSetup.githubAppID",
    "Private key (PEM)": "chatUi.chatEndpointSetup.privateKeyPEM",
    "Generate the webhook secret in Paperclip, then create one private GitHub App with active SSL-verified webhooks, Issues and Pull requests read/write permission, and the selectable issue_comment and pull_request_review_comment events. GitHub sends installation and installation_repositories automatically. Install the App only on repositories where people may mention the agent.": "oct5Metadata.githubBotGuidance",
  },
  "neon": {
    "A Neon account. The hosted server grants broad project and database management, so use a development project and review write actions before connecting production data.": "oct5MetadataAddendum.neonAccountWarning",
    "Neon recommends its hosted server for development and testing. Review write and destructive actions before execution.": "oct5MetadataAddendum.neonDevelopmentWarning",
    "Optional. Restrict this connection to one project. Copy the project ID from Neon Console → Project settings → General.": "oct5MetadataAddendum.neonProjectHelp",
    "Enable this to limit SQL to SELECT queries and schema inspection.": "oct5MetadataAddendum.neonReadOnlyHelp",
    "Project, branch, compute, snapshot, SQL and schema changes within the key’s reach. A project-scoped key limits access to one project with Editor rights; personal and organization keys reach every project they can access. Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.neonKey",
    "Manage Postgres projects and branches, run SQL, and inspect schemas in Neon.": "oct5Metadata.neonDescription",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Neon in the browser. Open Advanced to pin one project or enable read-only mode. Write tools start enabled and remain governed by Paperclip's action policies.": "oct5Metadata.neonOAuthGuidance",
    "Sign in with Neon": "oct5Metadata.neonSignIn",
    "Pin to project ID": "localizationApps.metadata247",
    "Optional Neon project ID": "oct5Metadata.neonProjectPlaceholder",
    "Read-only mode": "localizationApps.metadata250",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use a customer-created Neon API key. Prefer a project-scoped key for one development project; personal and organization keys reach every project they can access. Write tools start enabled and remain governed by Paperclip's action policies.": "oct5Metadata.neonApiGuidance",
    "Use an API key": "localizationApps.metadata24",
    "Neon API key": "oct5Metadata.neonApiKey",
  },
  "fireflies": {
    "Use an API key for an account with write access to the meetings your agents need to share, rename, move or turn into soundbites. Paperclip cannot increase the key’s permissions.": "oct5MetadataAddendum.firefliesKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use an API key": "localizationApps.metadata24",
  },
  "honcho": {
    "Create peers/sessions and save memory under the API key project. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.honchoKey",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
  },
  "youcom": {
    "None: search, contents and research tools (usage may be billed). A read-only key is sufficient.": "oct5MetadataAddendum.youKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
  },
  "imessage-photon": {
    "Message a Paperclip agent from Apple Messages using Photon Cloud. Pro supports DMs; dedicated lines also support groups.": "communityPhoton.metadataDescription",
    "Chat with an agent": "communityPhoton.metadataMethod",
    "Let people in iMessage Photon start and continue work with one Paperclip agent.": "communityPhoton.metadataWhenToUse",
    "Project secret": "communityPhoton.projectSecret",
    "Photon project secret": "communityPhoton.metadataSecretPlaceholder",
    "Connect a Photon Cloud project. Pro shared lines support DMs after sender enrollment in Photon and identity linking in Paperclip. Dedicated lines also support individually enabled groups.": "communityPhoton.metadataGuidance",
  },
  "agentmail": {
    "Give agents email inboxes and handle each conversation as a task.": "sep12Metadata.agentmailDescription",
    "Email with an agent": "sep12Metadata.agentmailMethod",
    "Assign an inbox to an agent and manage email conversations in tasks.": "sep12Metadata.agentmailWhenToUse",
    "AgentMail API key": "sep12Metadata.agentmailApiKey",
    "Connect an AgentMail API key, then create or select an inbox for your agent. WebSocket receiving works without a public URL.": "sep12Metadata.agentmailGuidance"
  },
  "airtable": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Airtable's provider-hosted MCP server.": "localizationApps.metadata0",
    "Sign in with Airtable": "localizationApps.metadata3"
  },
  "anthropic": {
    "Use Anthropic APIs with a restricted key.": "localizationApps.metadata4",
    "API key": "localizationApps.metadata7",
    "Claude subscription": "sep13AiMetadata.claudeSubscription",
    "Claude API key": "sep13AiMetadata.claudeApiKey",
    "Authenticate an agent with this account.": "sep13AiMetadata.whenToUse",
    "Use your personal account or an explicitly shared company account.": "sep13AiMetadata.guidance",
    "Enter API key": "sep13AiMetadata.apiKeyPlaceholder"
  },
  "openai": {
    "Connect OpenAI accounts for your agents.": "sep13AiMetadata.openaiDescription",
    "OpenAI subscription": "sep13AiMetadata.openaiSubscription",
    "OpenAI API key": "sep13AiMetadata.openaiApiKey",
    "Authenticate an agent with this account.": "sep13AiMetadata.whenToUse",
    "Use your personal account or an explicitly shared company account.": "sep13AiMetadata.guidance",
    "API key": "localizationApps.metadata7",
    "Enter API key": "sep13AiMetadata.apiKeyPlaceholder"
  },
  "openrouter": {
    "Connect OpenRouter accounts for your agents.": "sep13AiMetadata.openrouterDescription",
    "OpenRouter API key": "sep13AiMetadata.openrouterApiKey",
    "Authenticate an agent with this account.": "sep13AiMetadata.whenToUse",
    "Use your personal account or an explicitly shared company account.": "sep13AiMetadata.guidance",
    "API key": "localizationApps.metadata7",
    "Enter API key": "sep13AiMetadata.apiKeyPlaceholder"
  },
  "xai": {
    "Connect Grok accounts for your agents.": "sep13AiMetadata.grokDescription",
    "Grok subscription": "sep13AiMetadata.grokSubscription",
    "Grok API key": "sep13AiMetadata.grokApiKey",
    "Authenticate an agent with this account.": "sep13AiMetadata.whenToUse",
    "Use your personal account or an explicitly shared company account.": "sep13AiMetadata.guidance",
    "API key": "localizationApps.metadata7",
    "Enter API key": "sep13AiMetadata.apiKeyPlaceholder"
  },
  "api-key-generic": {
    "Actions depend on the operator-supplied API and key; grant read/write on the required resources at the provider. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.genericKey",
    "Use credentials from your provider account.": "oct5Metadata.providerCredentials",
    "API key": "localizationApps.metadata7",
    "Connect an API using a key from your provider.": "localizationApps.metadata9",
    "Paste the API key": "localizationApps.metadata11"
  },
  "asana": {
    "Connect your Asana account with Paperclip's app.": "oct5Metadata.asanaAccount",
    "Sign in to Asana with Paperclip. Asana gives this connection access to the workspaces available to your account.": "oct5Metadata.asanaGuidance",
    "Sign in with Asana": "oct5Metadata.asanaSignIn",
    "Create an MCP app in Asana, then add the callback URL below under OAuth. Under Manage distribution, select your workspace and save. API apps do not work with Asana MCP.": "oct5Metadata.asanaOwnApp",
    "Connect Asana's provider-hosted MCP server.": "localizationApps.metadata12",
    "Use your own OAuth app": "localizationApps.metadata15"
  },
  "box": {
    "Use your own OAuth app": "localizationApps.metadata15",
    "Connect Box's provider-hosted MCP server.": "localizationApps.metadata27"
  },
  "xero": {
    "Use your own OAuth app": "localizationApps.metadata15",
    "Connect Xero's provider-hosted MCP server.": "localizationApps.metadata347"
  },
  "beehiiv": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect beehiiv's provider-hosted MCP server.": "localizationApps.metadata16",
    "Sign in with beehiiv": "localizationApps.metadata18"
  },
  "bitly": {
    "Create/manage links in authorized groups. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.bitlyKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Connect Bitly's provider-hosted MCP server.": "localizationApps.metadata19",
    "Sign in with Bitly": "localizationApps.metadata21",
    "Use an API key": "localizationApps.metadata24",
    "Bitly API key": "localizationApps.metadata25",
    "Paste your Bitly API token": "localizationApps.metadata26"
  },
  "cloudflare": {
    "Cloudflare API actions selected at provider consent or on the API token. Identity scopes alone do not grant account writes. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.cloudflareKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Connect Cloudflare's provider-hosted MCP server.": "localizationApps.metadata42",
    "Sign in with Cloudflare": "localizationApps.metadata44",
    "Cloudflare API key": "localizationApps.metadata46",
    "Paste your Cloudflare API token": "localizationApps.metadata47"
  },
  "coda": {
    "Modify documents/tables permitted by the account. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.codaKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Connect Coda's provider-hosted MCP server.": "localizationApps.metadata51",
    "Sign in with Coda": "localizationApps.metadata53",
    "Coda API key": "localizationApps.metadata55",
    "Paste your Coda API token": "localizationApps.metadata56"
  },
  "kernel": {
    "Launch/manage browsers, profiles, apps and browser automation. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.kernelKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Connect Kernel's provider-hosted MCP server.": "localizationApps.metadata183",
    "Sign in with Kernel": "localizationApps.metadata185",
    "Kernel API key": "localizationApps.metadata187",
    "Paste your Kernel API key": "localizationApps.metadata188"
  },
  "mem0": {
    "Add/update/delete memories under the API key account. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.mem0Key",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Connect Mem0's provider-hosted MCP server.": "localizationApps.metadata200",
    "Mem0 API key": "localizationApps.metadata202"
  },
  "oreilly": {
    "None: content discovery and retrieval. A read-only key is sufficient.": "oct5MetadataAddendum.oreillyKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Connect O'Reilly's provider-hosted MCP server.": "localizationApps.metadata221",
    "Sign in with O'Reilly": "localizationApps.metadata223",
    "O'Reilly API key": "localizationApps.metadata225",
    "Paste your O'Reilly API token": "localizationApps.metadata226"
  },
  "razorpay": {
    "Provider-authorized payment/account tools; financial policy gates remain. Live verification outstanding. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.razorpayKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Connect Razorpay's provider-hosted MCP server.": "localizationApps.metadata278",
    "Sign in with Razorpay": "localizationApps.metadata280",
    "Razorpay API key": "localizationApps.metadata282",
    "Paste the base64-encoded key ID and secret": "localizationApps.metadata283"
  },
  "sanity": {
    "Edit content permitted by project role; global is MCP authorization, not a bypass of project ACLs. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.sanityKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Connect Sanity's provider-hosted MCP server.": "localizationApps.metadata287",
    "Sign in with Sanity": "localizationApps.metadata289",
    "Sanity API key": "localizationApps.metadata291"
  },
  "similarweb": {
    "None: analytics retrieval; subscription entitlements apply. A read-only key is sufficient.": "oct5MetadataAddendum.similarwebKey",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Connect Similarweb's provider-hosted MCP server.": "localizationApps.metadata306",
    "Similarweb API key": "localizationApps.metadata308",
    "Paste your Similarweb API key": "localizationApps.metadata309"
  },
  "stripe": {
    "Account- and sandbox-specific writes selected during Stripe consent; financial approvals and restricted-key permissions remain. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.stripeKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Connect Stripe's provider-hosted MCP server.": "localizationApps.metadata312",
    "Sign in with Stripe": "localizationApps.metadata314",
    "Stripe API key": "localizationApps.metadata316"
  },
  "supabase": {
    "Project/database/environment/storage changes and Edge Function deployment. Project selection and optional read-only configuration remain authoritative. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.supabaseKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Use an API key": "localizationApps.metadata24",
    "Read-only mode": "localizationApps.metadata250",
    "Feature groups": "localizationApps.metadata252",
    "Connect Supabase's provider-hosted MCP server.": "localizationApps.metadata318",
    "Sign in with Supabase": "localizationApps.metadata320",
    "Project reference": "localizationApps.metadata321",
    "Scope the connection to one development project.": "localizationApps.metadata323",
    "Enable this to prevent the connection from changing the database.": "localizationApps.metadata324",
    "Optional comma-separated feature groups.": "localizationApps.metadata326",
    "Supabase API key": "localizationApps.metadata328"
  },
  "brex": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Brex's provider-hosted MCP server.": "localizationApps.metadata30",
    "Sign in with Brex": "localizationApps.metadata32"
  },
  "candid": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Candid's provider-hosted MCP server.": "localizationApps.metadata33",
    "Sign in with Candid": "localizationApps.metadata35"
  },
  "clickhouse": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect ClickHouse's provider-hosted MCP server.": "localizationApps.metadata36",
    "Sign in with ClickHouse": "localizationApps.metadata38",
    "ClickHouse Cloud service ID": "localizationApps.metadata39",
    "Copy the service ID from ClickStack → Team Settings → API & Agents.": "localizationApps.metadata41"
  },
  "cloudinary": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Cloudinary's provider-hosted MCP server.": "localizationApps.metadata48",
    "Sign in with Cloudinary": "localizationApps.metadata50"
  },
  "composio": {
    "Connect Composio so Paperclip can discover and manage the toolkits in your project.": "localizationApps.metadata57",
    "Composio project API key": "localizationApps.metadata60",
    "Paste the Composio API key": "localizationApps.metadata61"
  },
  "context7": {
    "Look up current documentation for software libraries.": "localizationApps.metadata62"
  },
  "egnyte": {
    "Connect Egnyte's provider-hosted MCP server.": "localizationApps.metadata65",
    "Sign in with Egnyte": "localizationApps.metadata67"
  },
  "embat": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Embat's provider-hosted MCP server.": "localizationApps.metadata68",
    "Sign in with Embat": "localizationApps.metadata70"
  },
  "github": {
    "Repository contents, issues, pull requests and other granted toolsets; selected repos and installation/PAT permissions apply. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.githubKey",
    "Give agents access to GitHub repositories, issues, and pull requests.": "oct5Metadata.githubDescription",
    "Connect GitHub": "localizationProjectRepositories.connectGithub",
    "Read code and pull requests, and coordinate repository work.": "localizationApps.metadata71",
    "Connect with GitHub": "localizationApps.metadata72",
    "Personal access token (advanced)": "localizationApps.metadata75",
    "GitHub token": "localizationApps.metadata77"
  },
  "gmail": {
    "Search and read Gmail messages and create drafts without enabling mail sending.": "localizationApps.metadata79",
    "Connect with Paperclip": "localizationApps.metadata81",
    "Read only": "localizationApps.metadata82",
    "Search and read messages, threads, drafts, and labels.": "localizationApps.metadata83",
    "Use your own Google OAuth app": "localizationApps.metadata86",
    "Read & create drafts": "localizationApps.metadata89",
    "Read Gmail and create drafts for review in Gmail.": "localizationApps.metadata90"
  },
  "google-calendar": {
    "Connect with Paperclip": "localizationApps.metadata81",
    "Read only": "localizationApps.metadata82",
    "Use your own Google OAuth app": "localizationApps.metadata86",
    "Read calendars and manage Google Calendar events.": "localizationApps.metadata94",
    "Read calendars, events, and availability.": "localizationApps.metadata95",
    "Read & manage": "localizationApps.metadata100",
    "Create, update, respond to, and delete events.": "localizationApps.metadata101"
  },
  "google-chat": {
    "Connect with Paperclip": "localizationApps.metadata81",
    "Read only": "localizationApps.metadata82",
    "Use your own Google OAuth app": "localizationApps.metadata86",
    "Search and read Google Chat conversations and send messages.": "localizationApps.metadata105",
    "Search conversations and read messages.": "localizationApps.metadata106",
    "Read & send": "localizationApps.metadata111",
    "Read Chat and send messages.": "localizationApps.metadata112"
  },
  "google-docs": {
    "Connect with Paperclip": "localizationApps.metadata81",
    "Read only": "localizationApps.metadata82",
    "Use your own Google OAuth app": "localizationApps.metadata86",
    "Read and update Google Docs documents.": "localizationApps.metadata116",
    "Read document text and structure.": "localizationApps.metadata117",
    "Read & edit": "localizationApps.metadata122",
    "Read and update documents.": "localizationApps.metadata123"
  },
  "google-drive": {
    "Connect with Paperclip": "localizationApps.metadata81",
    "Read only": "localizationApps.metadata82",
    "Use your own Google OAuth app": "localizationApps.metadata86",
    "Search, read, create, and copy files in Google Drive.": "localizationApps.metadata127",
    "Search and read files and metadata.": "localizationApps.metadata128",
    "Read & create": "localizationApps.metadata133",
    "Read files and create or copy files.": "localizationApps.metadata134"
  },
  "google-people": {
    "Connect with Paperclip": "localizationApps.metadata81",
    "Use your own Google OAuth app": "localizationApps.metadata86",
    "Search contacts and directory profiles with the Google People API.": "localizationApps.metadata138",
    "Read contacts": "localizationApps.metadata139",
    "Search contacts, directory people, and your profile.": "localizationApps.metadata140"
  },
  "google-sheets": {
    "Connect with Paperclip": "localizationApps.metadata81",
    "Read only": "localizationApps.metadata82",
    "Use your own Google OAuth app": "localizationApps.metadata86",
    "Read & edit": "localizationApps.metadata122",
    "Read and update Google Sheets spreadsheets.": "localizationApps.metadata145",
    "Read spreadsheet values and structure.": "localizationApps.metadata146",
    "Read and update spreadsheet values, formulas, and dimensions.": "localizationApps.metadata151",
    "Use the Paperclip robot account": "localizationApps.metadata155",
    "Share selected sheets": "localizationApps.metadata156",
    "Share only named spreadsheets with the Paperclip robot account.": "localizationApps.metadata157"
  },
  "google-slides": {
    "Connect with Paperclip": "localizationApps.metadata81",
    "Read only": "localizationApps.metadata82",
    "Use your own Google OAuth app": "localizationApps.metadata86",
    "Read & edit": "localizationApps.metadata122",
    "Read and update Google Slides presentations.": "localizationApps.metadata160",
    "Read presentation slides and content.": "localizationApps.metadata161",
    "Read and update presentations.": "localizationApps.metadata166"
  },
  "google-workspace-search": {
    "Connect with Paperclip": "localizationApps.metadata81",
    "Use your own Google OAuth app": "localizationApps.metadata86",
    "Search Gmail, Drive, Calendar, and Chat through one read-only Google Workspace search tool.": "localizationApps.metadata170",
    "Search Workspace": "localizationApps.metadata171",
    "Search Gmail, Drive, Calendar, and Chat without write access.": "localizationApps.metadata172"
  },
  "hugging-face": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Hugging Face's provider-hosted MCP server.": "localizationApps.metadata177",
    "Sign in with Hugging Face": "localizationApps.metadata179"
  },
  "jira": {
    "Connect Jira's provider-hosted MCP server.": "localizationApps.metadata180",
    "Sign in with Jira": "localizationApps.metadata182"
  },
  "linear": {
    "Connect Linear for issues and projects. Paperclip registers its own OAuth client with Linear's MCP server, so no developer-console setup is needed.": "oct5Metadata.linearGuidance",
    "Create, update, and read Linear issues.": "localizationApps.metadata189"
  },
  "local-falcon": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Local Falcon's provider-hosted MCP server.": "localizationApps.metadata191",
    "Sign in with Local Falcon": "localizationApps.metadata193"
  },
  "make": {
    "Connect Make's provider-hosted MCP server.": "localizationApps.metadata194",
    "Sign in with Make": "localizationApps.metadata196"
  },
  "manufact": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Manufact's provider-hosted MCP server.": "localizationApps.metadata197",
    "Sign in with Manufact": "localizationApps.metadata199"
  },
  "miro": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Miro's provider-hosted MCP server.": "localizationApps.metadata204",
    "Sign in with Miro": "localizationApps.metadata206"
  },
  "mixpanel": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Mixpanel's provider-hosted MCP server.": "localizationApps.metadata207",
    "Sign in with Mixpanel": "localizationApps.metadata209"
  },
  "netlify": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Netlify's provider-hosted MCP server.": "localizationApps.metadata210",
    "Sign in with Netlify": "localizationApps.metadata212"
  },
  "notion": {
    "Read and update pages in your Notion workspace.": "localizationApps.metadata213"
  },
  "oauth-generic": {
    "Connect a provider using your own OAuth client.": "localizationApps.metadata215",
    "Client ID": "localizationApps.metadata217",
    "Paste the client ID": "localizationApps.metadata218",
    "Client secret": "localizationApps.metadata219",
    "Paste the client secret": "localizationApps.metadata220"
  },
  "pagerduty": {
    "Incident and on-call changes require a full-access API key and role access. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.pagerdutyKey",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Connect PagerDuty's provider-hosted MCP server.": "localizationApps.metadata227",
    "US service region": "localizationApps.metadata229",
    "PagerDuty API key": "localizationApps.metadata230",
    "Paste your PagerDuty user API token": "localizationApps.metadata231",
    "EU service region": "localizationApps.metadata232"
  },
  "planetscale": {
    "Read and write": "oct5Metadata.readWrite",
    "Query and change the databases you authorize in PlanetScale.": "oct5Metadata.planetscaleWrite",
    "Read only": "localizationApps.metadata82",
    "Inspect database performance with the insights-only server.": "oct5Metadata.planetscaleRead",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect PlanetScale's provider-hosted MCP server.": "localizationApps.metadata233",
    "Database access": "localizationApps.metadata235",
    "Project or database": "localizationApps.metadata236",
    "Optional project or database name": "localizationApps.metadata237",
    "Records the intended database boundary; final access is selected during PlanetScale authorization.": "localizationApps.metadata238",
    "Branch": "localizationApps.metadata239",
    "Optional branch name": "localizationApps.metadata240",
    "Records the intended branch boundary; final access is selected during PlanetScale authorization.": "localizationApps.metadata241",
    "Insights only": "localizationApps.metadata243"
  },
  "posthog": {
    "Analytics objects, feature flags, experiments, error triage and other enabled product actions. readonly/feature/tool filters remain enforced. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.posthogKey",
    "Analyze product usage, errors, feature flags, and experiments with PostHog's hosted MCP server.": "localizationApps.metadata244",
    "Pin to project ID": "localizationApps.metadata247",
    "Optional numeric project ID": "localizationApps.metadata248",
    "Optional. Pin this connection to one project and remove PostHog's project-switching tool.": "localizationApps.metadata249",
    "Read-only mode": "localizationApps.metadata250",
    "Turn on to hide tools that can change PostHog data.": "localizationApps.metadata251",
    "Feature groups": "localizationApps.metadata252",
    "Optional comma-separated feature groups": "localizationApps.metadata253",
    "Leave blank to expose every feature group, or enter a comma-separated list to narrow access.": "localizationApps.metadata254",
    "Individual tools": "localizationApps.metadata255",
    "Optional comma-separated tool names": "localizationApps.metadata256",
    "Leave blank to expose all tools. Exact names here are combined with any feature groups.": "localizationApps.metadata257",
    "Tool response mode": "localizationApps.metadata258",
    "Paperclip uses individual tools so every action can be governed. CLI mode remains unavailable until nested execution is governed.": "localizationApps.metadata259",
    "Sign in with PostHog": "localizationApps.metadata260",
    "Use a personal API key": "localizationApps.metadata262",
    "PostHog personal API key": "localizationApps.metadata263"
  },
  "postman": {
    "Collection/workspace/API actions supported by the selected minimal/code/full endpoint and account role. Create a key with read and write permissions for these actions; Paperclip cannot increase an existing key’s permissions.": "oct5MetadataAddendum.postmanKey",
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Use a restricted customer-owned key when browser sign-in is not suitable.": "oct5Metadata.restrictedKey",
    "Connect Postman's provider-hosted MCP server.": "localizationApps.metadata265",
    "US · Browser sign-in": "localizationApps.metadata267",
    "Minimal": "localizationApps.metadata268",
    "Essential workspace, collection, and environment tools with the smallest tool catalog.": "localizationApps.metadata269",
    "Code": "localizationApps.metadata270",
    "Tools for generating client code from API definitions.": "localizationApps.metadata271",
    "Full": "localizationApps.metadata272",
    "All Postman API tools, including write-capable collaboration and advanced features.": "localizationApps.metadata273",
    "EU · API key": "localizationApps.metadata275",
    "Postman API key": "localizationApps.metadata276"
  },
  "resend": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Resend's provider-hosted MCP server.": "localizationApps.metadata284",
    "Sign in with Resend": "localizationApps.metadata286"
  },
  "sentry": {
    "Investigate errors, releases, and production issues.": "localizationApps.metadata293"
  },
  "shopify": {
    "Search a store's products and policies, and manage shopping carts.": "localizationApps.metadata295",
    "Shopify UCP commerce": "localizationApps.metadata298",
    "Store domain": "localizationApps.metadata299",
    "Enter the permanent myshopify.com domain without https://. Custom storefront domains are not the MCP endpoint.": "localizationApps.metadata301",
    "Storefront policies and compatibility tools": "localizationApps.metadata304"
  },
  "slack": {
    "Use this connection as an agent tool": "chatUi.chatEndpointSetup.useThisConnectionAsAnAgentTool",
    "Chat with an agent": "communityPhoton.metadataMethod",
    "Bot User OAuth Token": "chatUi.chatEndpointSetup.botUserOAuthToken",
    "Signing Secret": "chatUi.chatEndpointSetup.signingSecret",
    "Search channels and coordinate team communication.": "localizationApps.metadata310"
  },
  "ticket-tailor": {
    "Connect Ticket Tailor's provider-hosted MCP server.": "localizationApps.metadata330",
    "Sign in with Ticket Tailor": "localizationApps.metadata332"
  },
  "ticktick": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect TickTick's provider-hosted MCP server.": "localizationApps.metadata333",
    "Sign in with TickTick": "localizationApps.metadata335"
  },
  "todoist": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Todoist's provider-hosted MCP server.": "localizationApps.metadata336",
    "Sign in with Todoist": "localizationApps.metadata338"
  },
  "vercel": {
    "Inspect projects, deployments, and runtime logs.": "localizationApps.metadata339"
  },
  "webflow": {
    "Connect Webflow's provider-hosted MCP server.": "localizationApps.metadata341",
    "Sign in with Webflow": "localizationApps.metadata343"
  },
  "wix": {
    "Use browser sign-in for the provider-hosted MCP server.": "oct5Metadata.providerBrowserSignIn",
    "Connect Wix's provider-hosted MCP server.": "localizationApps.metadata344",
    "Sign in with Wix": "localizationApps.metadata346"
  },
  "zapier": {
    "Reach thousands of apps through your Zapier account.": "localizationApps.metadata350",
    "Paste generated MCP URL": "localizationApps.metadata353"
  }
};
