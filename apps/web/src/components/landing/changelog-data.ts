// @workspace shared
export interface ChangelogVersion {
  version: string
  date: string
  titleKey: string
  items: string[]
}

export const changelog: ChangelogVersion[] = [
  {
    version: 'v1.7.0',
    date: '2026-07-04',
    titleKey: 'changelog.v170.title',
    items: [
      'changelog.v170.item1',
      'changelog.v170.item2',
      'changelog.v170.item3',
      'changelog.v170.item4',
      'changelog.v170.item5',
    ],
  },
  {
    version: 'v1.6.0',
    date: '2026-07-03',
    titleKey: 'changelog.v160.title',
    items: [
      'changelog.v160.item1',
      'changelog.v160.item2',
      'changelog.v160.item3',
      'changelog.v160.item4',
      'changelog.v160.item5',
    ],
  },
  {
    version: 'v1.5.0',
    date: '2026-07-02',
    titleKey: 'changelog.v150.title',
    items: [
      'changelog.v150.item1',
      'changelog.v150.item2',
      'changelog.v150.item3',
      'changelog.v150.item4',
    ],
  },
  {
    version: 'v1.4.0',
    date: '2026-07-01',
    titleKey: 'changelog.v140.title',
    items: [
      'changelog.v140.item1',
      'changelog.v140.item2',
      'changelog.v140.item3',
      'changelog.v140.item4',
      'changelog.v140.item5',
    ],
  },
  {
    version: 'v1.3.0',
    date: '2026-06-30',
    titleKey: 'changelog.v130.title',
    items: [
      'changelog.v130.item1',
      'changelog.v130.item2',
      'changelog.v130.item3',
      'changelog.v130.item4',
    ],
  },
  {
    version: 'v1.2.0',
    date: '2026-06-29',
    titleKey: 'changelog.v120.title',
    items: [
      'changelog.v120.item1',
      'changelog.v120.item2',
      'changelog.v120.item3',
      'changelog.v120.item4',
    ],
  },
  {
    version: 'v1.1.0',
    date: '2026-06-28',
    titleKey: 'changelog.v110.title',
    items: [
      'changelog.v110.item1',
      'changelog.v110.item2',
      'changelog.v110.item3',
      'changelog.v110.item4',
      'changelog.v110.item5',
    ],
  },
  {
    version: 'v1.0.0',
    date: '2026-06-27',
    titleKey: 'changelog.v100.title',
    items: [
      'changelog.v100.item1',
      'changelog.v100.item2',
      'changelog.v100.item3',
      'changelog.v100.item4',
    ],
  },
]
