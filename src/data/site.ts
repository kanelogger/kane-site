export const site = {
  tagline: 'Software Engineer · AI Coding Agent / Harness / Developer Tools',
  description: 'Kane 的个人网站，记录 AI Coding Agent、Agent Harness、开发者工具与 AI 原生软件工程实践。',
  intro: '我研究并实践 AI 原生开发，关注 Coding Agent 如何恢复项目上下文、在硬门禁与反馈回路中可靠推进，以及怎样把重复工作沉淀为可复用的开发者工具。这里收录我的项目、工程实践与长期研究。',
  contacts: [
    { name: 'GitHub', label: 'github.com/kanelogger', href: 'https://github.com/kanelogger' },
    { name: 'X', label: '@kanelogger', href: 'https://x.com/kanelogger' }
  ],
};

export const siteByLocale = {
  'zh-CN': site,
  en: {
    tagline: 'Software Engineer · AI Coding Agent / Harness / Developer Tools',
    description: 'Kane’s personal site about AI Coding Agents, Agent Harnesses, developer tools, and AI-native software engineering.',
    intro: 'I study and practice AI-native development: how Coding Agents recover project context, move reliably through hard gates and feedback loops, and turn repeated work into reusable developer tools.',
    contacts: site.contacts,
  },
} as const;

export type SiteCopy = (typeof siteByLocale)[keyof typeof siteByLocale];

export function getSiteCopy(locale: 'zh-CN' | 'en' = 'zh-CN'): SiteCopy {
  return siteByLocale[locale];
}
