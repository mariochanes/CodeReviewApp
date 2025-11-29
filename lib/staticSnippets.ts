/**
 * Static code snippets for immediate display while dynamic content loads
 * These snippets are bundled with the app and displayed immediately on first load
 * to improve perceived performance, especially on mobile devices.
 */

export interface StaticSnippet {
  repository: string;
  filePath: string;
  content: string;
  language: string;
  startLine: number;
  endLine: number;
  url: string;
  commitAuthor?: string;
  commitAuthorLogin?: string;
}

export const staticSnippets: StaticSnippet[] = [
  {
    repository: "facebook/react",
    filePath: "packages/react/src/React.js",
    language: "javascript",
    startLine: 15,
    endLine: 45,
    content: `/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

import ReactVersion from 'shared/ReactVersion';
import {
  REACT_FRAGMENT_TYPE,
  REACT_PROFILER_TYPE,
  REACT_STRICT_MODE_TYPE,
  REACT_SUSPENSE_TYPE,
  REACT_SUSPENSE_LIST_TYPE,
} from 'shared/ReactSymbols';

import {Component, PureComponent} from './ReactBaseClasses';
import {createRef} from './ReactCreateRef';
import {forEach, map, count, toArray, only} from './ReactChildren';
import {
  createElement,
  createFactory,
  cloneElement,
  isValidElement,
  jsx,
} from './ReactElement';
import {createContext} from './ReactContext';
import {lazy} from './ReactLazy';
import {forwardRef} from './ReactForwardRef';
import {memo} from './ReactMemo';`,
    url: "https://github.com/facebook/react/blob/main/packages/react/src/React.js#L15-L45",
    commitAuthor: "Dan Abramov",
    commitAuthorLogin: "gaearon"
  },
  {
    repository: "vercel/next.js",
    filePath: "packages/next/src/client/components/app-router.tsx",
    language: "typescript",
    startLine: 120,
    endLine: 150,
    content: `/**
 * AppRouter is responsible for handling client-side navigations and
 * data fetching.
 */
export function AppRouter({
  buildId,
  initialHead,
  initialTree,
  initialCanonicalUrl,
  children,
  assetPrefix,
}: AppRouterProps): React.ReactElement {
  const initialState = useMemo(
    () => ({
      buildId,
      tree: initialTree,
      canonicalUrl: initialCanonicalUrl,
      pushRef: {
        pendingPush: false,
        mpaNavigation: false,
        // Determines if the history should be updated. This is set to false in
        // layout-router during the navigation and then set to true once the
        // navigation is committed.
        preserveCustomHistoryState: true,
      },
      focusAndScrollRef: {
        apply: false,
        onlyHashChange: false,
        hashFragment: null,
        segmentPaths: [],
      },
      cache: new Map(),
      prefetchCache: new Map(),
    }),
    [buildId, initialCanonicalUrl, initialTree]
  )`,
    url: "https://github.com/vercel/next.js/blob/canary/packages/next/src/client/components/app-router.tsx#L120-L150",
    commitAuthor: "Tim Neutkens",
    commitAuthorLogin: "timneutkens"
  },
  {
    repository: "microsoft/TypeScript",
    filePath: "src/compiler/checker.ts",
    language: "typescript",
    startLine: 1500,
    endLine: 1530,
    content: `function checkIdentifier(node: Identifier, meaning: SymbolFlags): Symbol | undefined {
    const symbol = resolveIdentifier(node, meaning);
    if (!symbol) {
        return undefined;
    }

    // If this is a type parameter that we've inferred from a generic type alias, check the constraints.
    // We use resolveIdentifier rather than getSymbolOfNode because we need to unwrap the alias.
    if (symbol.flags & SymbolFlags.TypeParameter) {
        const links = getSymbolLinks(symbol);
        if (links.typeParameter) {
            const typeParameter = links.typeParameter;
            if (typeParameter.constraint) {
                checkTypeAssignableTo(
                    getTypeParameterInstantiation(symbol),
                    getTypeFromTypeNode(typeParameter.constraint),
                    node,
                    Diagnostics.Type_0_does_not_satisfy_the_constraint_1,
                    Diagnostics.Type_0_does_not_satisfy_the_constraint_1_Consider_adding_type_parameters_to_the_call_expression
                );
            }
        }
    }

    return symbol;
}`,
    url: "https://github.com/microsoft/TypeScript/blob/main/src/compiler/checker.ts#L1500-L1530",
    commitAuthor: "Ryan Cavanaugh",
    commitAuthorLogin: "RyanCavanaugh"
  },
  {
    repository: "golang/go",
    filePath: "src/runtime/proc.go",
    language: "go",
    startLine: 200,
    endLine: 230,
    content: `// Create a new g running fn with siz bytes of arguments.
// Put it on the queue of g's waiting to run.
// The compiler turns a go statement into a call to this.
func newproc(fn *funcval, argp unsafe.Pointer, siz int32, goexit bool) {
	// Create a new g running fn with siz bytes of arguments.
	mp := acquirem() // disable preemption because we hold M and P in local vars.
	
	// Find the g that called us.
	// After this, we might not have a P anymore, so we must not block.
	gp := getg()
	pc := getcallerpc()
	
	// Create a new g.
	newg := newproc1(fn, argp, siz, gp, pc)
	
	// Start the new g.
	runqput(mp.p.ptr(), newg, true)
	
	if mainStarted {
		wakep()
	}
	
	releasem(mp)
}`,
    url: "https://github.com/golang/go/blob/master/src/runtime/proc.go#L200-L230",
    commitAuthor: "Ian Lance Taylor",
    commitAuthorLogin: "ianlancetaylor"
  },
  {
    repository: "sveltejs/svelte",
    filePath: "src/runtime/internal/Component.js",
    language: "javascript",
    startLine: 50,
    endLine: 80,
    content: `export function mount_component(component, target, anchor) {
	const { fragment, after_update } = component.$$;

	fragment && fragment.m(target, anchor);

	// onMount happens before the initial afterUpdate
	add_render_callback(() => {
		const new_on_destroy = component.$$.on_mount.map(run).filter(is_function);
		// if the component was destroyed immediately
		// it will update the $$.on_destroy reference to $$.on_mount if they are the same
		if (component.$$.on_destroy === component.$$.on_mount) {
			component.$$.on_destroy = new_on_destroy;
		} else {
			component.$$.on_destroy.push(...new_on_destroy);
		}
		component.$$.on_mount = [];
	});

	after_update.forEach(add_render_callback);
}

export function destroy_component(component, detaching) {
	const $$ = component.$$;
	if ($$.fragment !== null) {
		flush_render_callbacks($$.after_update);
		run_all($$.on_destroy);
		$$.fragment && $$.fragment.d(detaching);
		$$.on_destroy = $$.fragment = null;
		$$.ctx = [];
	}
}`,
    url: "https://github.com/sveltejs/svelte/blob/master/src/runtime/internal/Component.js#L50-L80",
    commitAuthor: "Rich Harris",
    commitAuthorLogin: "Rich-Harris"
  }
];

/**
 * Get a random static snippet from the pre-selected collection
 */
export function getRandomStaticSnippet(): StaticSnippet {
  const randomIndex = Math.floor(Math.random() * staticSnippets.length);
  return staticSnippets[randomIndex];
}
