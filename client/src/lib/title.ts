// Composes document.title from two independent sources — the current
// page's name and the live active-alert count — so an operator with the
// app in a background tab sees "(2) ALERT · Live Map · Falcon Eye".

let pageTitle = ""
let alertCount = 0

function render() {
  const parts = [pageTitle, "Falcon Eye"].filter(Boolean).join(" · ")
  document.title = alertCount > 0 ? `(${alertCount}) ALERT · ${parts}` : parts
}

export function setPageTitle(title: string) {
  pageTitle = title
  render()
}

export function setAlertCountInTitle(count: number) {
  alertCount = count
  render()
}
