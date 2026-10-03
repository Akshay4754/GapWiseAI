import { useEffect } from "react";

// Sets the browser tab title for the current page
export function usePageTitle(title) {
  useEffect(() => {
    if (title) document.title = title;
  }, [title]);
}
