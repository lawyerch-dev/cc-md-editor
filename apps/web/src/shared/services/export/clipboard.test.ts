// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

/**
 * Tests for WeChat compatibility processing.
 *
 * `processClipboardContent` depends on Pinia stores and live DOM, so we test
 * the DOM manipulation transforms in isolation. These mirrors the exact
 * algorithms used inside clipboard.ts.
 */

/** Replicates solveWeChatImage from clipboard.ts */
function solveWeChatImage(container: HTMLElement) {
  const images = container.getElementsByTagName(`img`)
  Array.from(images).forEach((image) => {
    const width = image.getAttribute(`width`)
    const height = image.getAttribute(`height`)
    if (width) {
      image.removeAttribute(`width`)
      image.style.width = /^\d+$/.test(width) ? `${width}px` : width
    }
    if (height) {
      image.removeAttribute(`height`)
      image.style.height = /^\d+$/.test(height) ? `${height}px` : height
    }
  })
}

describe(`solveWeChatImage`, () => {
  it(`converts numeric width/height attributes to px inline styles`, () => {
    const container = document.createElement(`div`)
    container.innerHTML = `<img src="test.png" width="300" height="200">`

    solveWeChatImage(container)

    const img = container.querySelector(`img`)!
    expect(img.getAttribute(`width`)).toBeNull()
    expect(img.getAttribute(`height`)).toBeNull()
    expect(img.style.width).toBe(`300px`)
    expect(img.style.height).toBe(`200px`)
  })

  it(`preserves non-numeric width/height values as-is`, () => {
    const container = document.createElement(`div`)
    container.innerHTML = `<img src="test.png" width="100%" height="auto">`

    solveWeChatImage(container)

    const img = container.querySelector(`img`)!
    expect(img.style.width).toBe(`100%`)
    expect(img.style.height).toBe(`auto`)
  })

  it(`leaves images without width/height unchanged`, () => {
    const container = document.createElement(`div`)
    container.innerHTML = `<img src="test.png">`

    solveWeChatImage(container)

    const img = container.querySelector(`img`)!
    expect(img.style.width).toBe(``)
    expect(img.style.height).toBe(``)
  })

  it(`processes multiple images in the container`, () => {
    const container = document.createElement(`div`)
    container.innerHTML = `
      <img src="a.png" width="100" height="50">
      <img src="b.png" width="200">
      <img src="c.png">
    `

    solveWeChatImage(container)

    const imgs = container.querySelectorAll(`img`)
    expect(imgs[0].style.width).toBe(`100px`)
    expect(imgs[0].style.height).toBe(`50px`)
    expect(imgs[1].style.width).toBe(`200px`)
    expect(imgs[2].style.width).toBe(``)
  })

  it(`handles empty container without error`, () => {
    const container = document.createElement(`div`)
    expect(() => solveWeChatImage(container)).not.toThrow()
  })
})

describe(`weChat list→paragraph conversion`, () => {
  /** Replicates the list conversion from processClipboardContent */
  function convertListsToParagraphs(root: HTMLElement) {
    let lis = root.querySelectorAll(`li`)
    const liPositions = new Map<Element, number>()
    for (const ol of root.querySelectorAll(`ol`)) {
      let idx = 1
      for (const child of ol.children) {
        if (child.tagName === `LI`)
          liPositions.set(child, idx++)
      }
    }
    while (lis.length) {
      const deepest = Array.from(lis).filter(li => !li.querySelector(`li`))
      if (!deepest.length)
        break
      for (const li of deepest) {
        const nestedLists: Element[] = []
        li.querySelectorAll(`:scope > ul, :scope > ol`).forEach(l => nestedLists.push(l))
        nestedLists.forEach(l => li.removeChild(l))
        const parent = li.parentElement
        const isOrdered = parent?.tagName === `OL`
        const p = document.createElement(`p`)
        p.setAttribute(`data-from-list`, `true`)
        p.innerHTML = li.innerHTML
        p.style.display = `block`
        p.style.listStyle = `none`
        const firstTn = Array.from(p.childNodes).find(n => n.nodeType === 3)
        if (firstTn)
          firstTn.textContent = (firstTn.textContent ?? ``).replace(/^\d+\.\s*/, ``).replace(/^[•·\-*]\s*/, ``)
        if (isOrdered) {
          const idx = liPositions.get(li) ?? 1
          p.innerHTML = `${idx}. ${p.innerHTML}`
        }
        parent?.insertBefore(p, li)
        li.remove()
        nestedLists.forEach(l => p.parentElement?.insertBefore(l, p.nextSibling))
      }
      lis = root.querySelectorAll(`li`)
    }
    root.querySelectorAll(`ul, ol`).forEach((list) => {
      if (!list.querySelector(`li`)) {
        const listParent = list.parentElement
        if (listParent) {
          while (list.firstChild) listParent.insertBefore(list.firstChild, list)
          listParent.removeChild(list)
        }
      }
    })
    root.querySelectorAll<HTMLElement>(`p[data-from-list]`).forEach((p) => {
      p.removeAttribute(`data-from-list`)
      p.style.marginTop = `0`
      p.style.marginBottom = `0`
    })
  }

  it(`converts unordered list items to paragraphs`, () => {
    const root = document.createElement(`div`)
    root.innerHTML = `<ul><li>Item A</li><li>Item B</li></ul>`
    convertListsToParagraphs(root)

    expect(root.querySelector(`ul`)).toBeNull()
    expect(root.querySelector(`li`)).toBeNull()
    const paragraphs = root.querySelectorAll(`p`)
    expect(paragraphs).toHaveLength(2)
    expect(paragraphs[0].textContent).toContain(`Item A`)
    expect(paragraphs[1].textContent).toContain(`Item B`)
  })

  it(`preserves ordered list numbering`, () => {
    const root = document.createElement(`div`)
    root.innerHTML = `<ol><li>First</li><li>Second</li><li>Third</li></ol>`
    convertListsToParagraphs(root)

    const paragraphs = root.querySelectorAll(`p`)
    expect(paragraphs[0].innerHTML).toMatch(/^1\.\s/)
    expect(paragraphs[1].innerHTML).toMatch(/^2\.\s/)
    expect(paragraphs[2].innerHTML).toMatch(/^3\.\s/)
  })

  it(`strips bullet prefixes from unordered items`, () => {
    const root = document.createElement(`div`)
    root.innerHTML = `<ul><li>• Already prefixed</li></ul>`
    convertListsToParagraphs(root)

    const p = root.querySelector(`p`)!
    expect(p.textContent).not.toMatch(/^•/)
    expect(p.textContent).toContain(`Already prefixed`)
  })

  it(`sets display:block and removes list-style on converted paragraphs`, () => {
    const root = document.createElement(`div`)
    root.innerHTML = `<ul><li>Test</li></ul>`
    convertListsToParagraphs(root)

    const p = root.querySelector(`p`) as HTMLElement
    expect(p.style.display).toBe(`block`)
    expect(p.style.listStyle).toBe(`none`)
    // jsdom normalizes '0' to '0px'
    expect(p.style.marginTop).toMatch(/^0(px)?$/)
    expect(p.style.marginBottom).toMatch(/^0(px)?$/)
  })

  it(`handles nested lists (ul inside li)`, () => {
    const root = document.createElement(`div`)
    root.innerHTML = `
      <ul>
        <li>Parent
          <ul><li>Child A</li><li>Child B</li></ul>
        </li>
      </ul>
    `
    convertListsToParagraphs(root)

    const paragraphs = root.querySelectorAll(`p`)
    expect(paragraphs.length).toBeGreaterThanOrEqual(3)
    expect(root.querySelector(`ul`)).toBeNull()
    expect(root.querySelector(`li`)).toBeNull()
  })
})

describe(`weChat blockquote→section conversion`, () => {
  /** Replicates the blockquote conversion from processClipboardContent */
  function convertBlockquotes(root: HTMLElement) {
    root.querySelectorAll(`blockquote`).forEach((bq) => {
      const section = document.createElement(`section`)
      for (const attr of bq.attributes)
        section.setAttribute(attr.name, attr.value)
      section.innerHTML = bq.innerHTML
      bq.parentElement?.replaceChild(section, bq)
    })
  }

  it(`converts blockquote to section`, () => {
    const root = document.createElement(`div`)
    root.innerHTML = `<blockquote><p>A quote</p></blockquote>`
    convertBlockquotes(root)

    expect(root.querySelector(`blockquote`)).toBeNull()
    const section = root.querySelector(`section`)!
    expect(section).not.toBeNull()
    expect(section.innerHTML).toContain(`A quote`)
  })

  it(`preserves attributes on converted section`, () => {
    const root = document.createElement(`div`)
    root.innerHTML = `<blockquote class="custom" data-lang="en"><p>Quote</p></blockquote>`
    convertBlockquotes(root)

    const section = root.querySelector(`section`)!
    expect(section.getAttribute(`class`)).toBe(`custom`)
    expect(section.getAttribute(`data-lang`)).toBe(`en`)
  })

  it(`converts outer blockquote even when nested`, () => {
    const root = document.createElement(`div`)
    root.innerHTML = `<blockquote><blockquote><p>Nested</p></blockquote></blockquote>`
    convertBlockquotes(root)

    // Outer blockquote becomes section; inner blockquote is orphaned
    // during conversion (innerHTML copy detaches it) so only outer converts
    const section = root.querySelector(`section`)!
    expect(section).not.toBeNull()
    expect(section.querySelector(`blockquote`)).not.toBeNull()
  })
})
