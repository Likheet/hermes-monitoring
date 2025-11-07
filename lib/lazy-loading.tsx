"use client"

import { lazy, Suspense, useState, useRef, useEffect, createElement, type ComponentType, type ReactNode, type FC } from "react"
import { Loader2 } from "lucide-react"

// Enhanced loading component with better UX
interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg"
  message?: string
}

export function LoadingSpinner({ size = "md", message = "Loading..." }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-8 w-8",
    lg: "h-12 w-12"
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <Loader2 className={`animate-spin text-primary ${sizeClasses[size]}`} />
      <p className="text-muted-foreground text-sm">{message}</p>
    </div>
  )
}

// Enhanced lazy wrapper with error boundary and loading states
type ComponentPropsShape = Record<string, unknown>

type LoaderResult<TProps extends ComponentPropsShape = ComponentPropsShape> = { default: ComponentType<TProps> }

interface LazyWrapperProps<TProps extends ComponentPropsShape = ComponentPropsShape> {
  loader: () => Promise<LoaderResult<TProps>>
  fallback?: ReactNode
  errorFallback?: ReactNode
  componentProps?: TProps
}

export function LazyWrapper<TProps extends ComponentPropsShape = ComponentPropsShape>({
  loader,
  fallback = <LoadingSpinner message="Loading component..." />,
  errorFallback = (
    <div className="flex items-center justify-center p-8">
      <div className="text-center">
        <p className="text-red-500 mb-2">Failed to load component</p>
        <button
          onClick={() => window.location.reload()}
          className="text-blue-500 underline text-sm"
        >
          Try again
        </button>
      </div>
    </div>
  ),
  componentProps,
}: LazyWrapperProps<TProps>) {
  const LazyComponent = lazy(async () => {
    try {
      return await loader()
    } catch (error) {
      console.error("Failed to load lazy component:", error)
      const FallbackComponent: ComponentType<TProps> = () => <>{errorFallback}</>
      return { default: FallbackComponent }
    }
  })

  return (
    <Suspense fallback={fallback}>
      {createElement(LazyComponent as ComponentType<TProps>, componentProps ?? ({} as TProps))}
    </Suspense>
  )
}

// Preloading utilities
class ComponentPreloader {
  private preloadCache = new Map<string, Promise<LoaderResult<ComponentPropsShape>>>()

  preloadComponent<TProps extends ComponentPropsShape = ComponentPropsShape>(
    key: string,
    loader: () => Promise<LoaderResult<TProps>>,
  ) {
    if (this.preloadCache.has(key)) {
      return this.preloadCache.get(key) as Promise<LoaderResult<TProps>>
    }

    const promise = loader().catch(error => {
      console.error(`Failed to preload component ${key}:`, error)
      this.preloadCache.delete(key)
      throw error
    }) as Promise<LoaderResult<TProps>>

    this.preloadCache.set(key, promise as Promise<LoaderResult<ComponentPropsShape>>)
    return promise
  }

  clearPreloadCache() {
    this.preloadCache.clear()
  }
}

export const componentPreloader = new ComponentPreloader()

// Lazy loading HOC with preloading support
interface CreateLazyComponentOptions {
  preloadKey?: string
  loadingMessage?: string
  fallback?: ReactNode
  errorFallback?: ReactNode
}

export function createLazyComponent<TProps extends ComponentPropsShape = ComponentPropsShape>(
  loader: () => Promise<LoaderResult<TProps>>,
  options: CreateLazyComponentOptions = {}
) {
  const {
    preloadKey,
    loadingMessage = "Loading...",
    fallback,
    errorFallback,
  } = options

  if (preloadKey) {
    void componentPreloader.preloadComponent(preloadKey, loader)
  }

  const resolvedFallback = fallback ?? <LoadingSpinner message={loadingMessage} />

  const WrappedLazyComponent: FC<TProps> = function WrappedLazyComponent(props) {
    return (
      <LazyWrapper<TProps>
        loader={loader}
        fallback={resolvedFallback}
        errorFallback={errorFallback}
        componentProps={props}
      />
    )
  }

  WrappedLazyComponent.displayName = preloadKey ? `LazyComponent(${preloadKey})` : "LazyComponent"

  return WrappedLazyComponent
}

// Intersection Observer based lazy loading for better performance
interface IntersectionLazyOptions {
  rootMargin?: string
  threshold?: number
}

export function useIntersectionLazy<TProps extends ComponentPropsShape = ComponentPropsShape>(
  loader: () => Promise<LoaderResult<TProps>>,
  options: IntersectionLazyOptions = {}
) {
  const { rootMargin = "50px", threshold = 0.1 } = options

  const [resolvedComponent, setResolvedComponent] = useState<ComponentType<TProps> | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const elementRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = elementRef.current
    if (!element) return

    const observer = new IntersectionObserver(
      async (entries) => {
        const [entry] = entries
        if (entry.isIntersecting && !resolvedComponent && !isLoading) {
          setIsLoading(true)
          try {
            const loadedModule = await loader()
            setResolvedComponent(() => loadedModule.default)
          } catch (err) {
            setError(err instanceof Error ? err : new Error("Failed to load component"))
          } finally {
            setIsLoading(false)
          }
        }
      },
      { rootMargin, threshold }
    )

    observer.observe(element)

    return () => {
      observer.unobserve(element)
    }
  }, [loader, resolvedComponent, isLoading, rootMargin, threshold])

  return {
    Component: resolvedComponent,
    isLoading,
    error,
    elementRef
  }
}
