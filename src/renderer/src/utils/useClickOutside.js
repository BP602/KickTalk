import { useEffect } from 'react'

// CommonJS/ESM-friendly version to avoid requiring .jsx in tests
export default function useClickOutside(ref, handler) {
  useEffect(() => {
    let startedInside = false
    let startedWhenMounted = false

    const listener = (event) => {
      if (startedInside || !startedWhenMounted) return
      if (!ref.current || ref.current.contains(event.target)) return
      try { handler(event) } catch {}
    }

    const validateEventStart = (event) => {
      startedWhenMounted = !!ref.current
      startedInside = !!(ref.current && ref.current.contains(event.target))
    }

    document.addEventListener('mousedown', validateEventStart)
    document.addEventListener('touchstart', validateEventStart)
    document.addEventListener('click', listener)

    return () => {
      document.removeEventListener('mousedown', validateEventStart)
      document.removeEventListener('touchstart', validateEventStart)
      document.removeEventListener('click', listener)
    }
  }, [ref, handler])
}
