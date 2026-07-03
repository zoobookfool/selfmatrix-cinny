import React, { ComponentProps, MutableRefObject, ReactNode } from 'react';
import { Box, Header, Line, Scroll, Text, as } from 'folds';
import classNames from 'classnames';
import { useAtomValue } from 'jotai';
import { ContainerColor } from '../../styles/ContainerColor.css';
import * as css from './style.css';
import { ScreenSize, useScreenSizeContext } from '../../hooks/useScreenSize';
import { getNavPosition, isHorizontalDockPosition, shellLayoutAtom } from '../../state/shellLayout';

type PageRootProps = {
  nav: ReactNode;
  children: ReactNode;
  /**
   * Reverses the row order (nav <-> content) without changing DOM structure.
   * Used by the main client routes to honor the shell's channel-list docking
   * side. Left unset (falsy) for nested PageRoot usages (e.g. Settings,
   * SpaceSettings, RoomSettings) so those internal layouts stay unaffected.
   */
  reverse?: boolean;
  /**
   * Stacks nav/content vertically (Column/ColumnReverse) instead of the
   * default row layout. Used for the shell's top/bottom channel-list docking
   * (Stage 2). The separator direction flips to Horizontal to match.
   */
  stackDirection?: 'Column' | 'ColumnReverse';
};

export function PageRoot({ nav, children, reverse, stackDirection }: PageRootProps) {
  const screenSize = useScreenSizeContext();

  let direction: ComponentProps<typeof Box>['direction'];
  if (stackDirection) {
    direction = stackDirection;
  } else if (reverse) {
    direction = 'RowReverse';
  }

  return (
    <Box grow="Yes" direction={direction} className={ContainerColor({ variant: 'Background' })}>
      {nav}
      {screenSize !== ScreenSize.Mobile && (
        <Line
          variant="Background"
          size="300"
          direction={stackDirection ? 'Horizontal' : 'Vertical'}
        />
      )}
      {children}
    </Box>
  );
}

type MainPageRootProps = Omit<PageRootProps, 'reverse' | 'stackDirection'> & {
  /**
   * Whether this route's nav renders a chip-row layout when the channel list
   * is docked top/bottom (Stage 2). Only Home and Space implement chip nav
   * so far; other routes (Direct/Explore/Inbox) pass this as false/omit it
   * and fall back to the classic left-docked column nav so they don't break
   * when the user picks a top/bottom setting.
   */
  chipNavSupported?: boolean;
};

/**
 * PageRoot variant for the main client routes (Home/Direct/Space/Explore/
 * Inbox) that reads the shell's channel-list docking preference and mirrors
 * PageRoot accordingly. Not used by Settings/SpaceSettings/RoomSettings,
 * which render PageRoot directly and are unaffected by this setting.
 */
export function MainPageRoot({ nav, children, chipNavSupported }: MainPageRootProps) {
  const shellLayout = useAtomValue(shellLayoutAtom);
  const navPosition = getNavPosition(shellLayout);

  if (chipNavSupported && isHorizontalDockPosition(navPosition)) {
    return (
      <PageRoot nav={nav} stackDirection={navPosition === 'bottom' ? 'ColumnReverse' : 'Column'}>
        {children}
      </PageRoot>
    );
  }

  // Routes without chip-nav support (or non-horizontal positions) keep the
  // Stage 1 left/right row layout. top/bottom fall back to left here.
  const reverse = navPosition === 'right';

  return (
    <PageRoot nav={nav} reverse={reverse}>
      {children}
    </PageRoot>
  );
}

type ClientDrawerLayoutProps = {
  children: ReactNode;
};

/**
 * Whether the current route should render its channel-list nav as a
 * horizontal chip row (Stage 2). `chipNavSupported` must be passed by the
 * calling route (only Home and Space do so today); routes that don't pass it
 * always get the classic column nav, even when the shell's nav position is
 * top/bottom, so they don't break before their chip-nav layout exists.
 * Also false on Mobile, which keeps its own dedicated layout regardless of
 * this shell setting.
 */
export function useChipNavLayout(chipNavSupported?: boolean): boolean {
  const screenSize = useScreenSizeContext();
  const shellLayout = useAtomValue(shellLayoutAtom);
  const navPosition = getNavPosition(shellLayout);
  return (
    !!chipNavSupported && screenSize !== ScreenSize.Mobile && isHorizontalDockPosition(navPosition)
  );
}

export function PageNav({
  size,
  chipNavSupported,
  children,
}: ClientDrawerLayoutProps & css.PageNavVariants & { chipNavSupported?: boolean }) {
  const screenSize = useScreenSizeContext();
  const isMobile = screenSize === ScreenSize.Mobile;
  const chipNav = useChipNavLayout(chipNavSupported);

  return (
    <Box
      grow={isMobile ? 'Yes' : undefined}
      className={chipNav ? css.PageNavHorizontal : css.PageNav({ size })}
      shrink={isMobile ? 'Yes' : 'No'}
    >
      <Box grow="Yes" direction={chipNav ? 'Row' : 'Column'}>
        {children}
      </Box>
    </Box>
  );
}

export const PageNavHeader = as<'header', css.PageNavHeaderVariants>(
  ({ className, outlined, ...props }, ref) => (
    <Header
      className={classNames(css.PageNavHeader({ outlined }), className)}
      variant="Background"
      size="600"
      {...props}
      ref={ref}
    />
  )
);

export function PageNavContent({
  scrollRef,
  chipNavSupported,
  children,
}: {
  children: ReactNode;
  scrollRef?: MutableRefObject<HTMLDivElement | null>;
  chipNavSupported?: boolean;
}) {
  const chipNav = useChipNavLayout(chipNavSupported);

  return (
    <Box grow="Yes" direction={chipNav ? 'Row' : 'Column'}>
      <Scroll
        ref={scrollRef}
        variant="Background"
        direction={chipNav ? 'Horizontal' : 'Vertical'}
        size="300"
        hideTrack
        visibility="Hover"
      >
        <div className={chipNav ? css.PageNavContentHorizontal : css.PageNavContent}>
          {children}
        </div>
      </Scroll>
    </Box>
  );
}

export const Page = as<'div'>(({ className, ...props }, ref) => (
  <Box
    grow="Yes"
    direction="Column"
    className={classNames(ContainerColor({ variant: 'Surface' }), className)}
    {...props}
    ref={ref}
  />
));

export const PageHeader = as<'div', css.PageHeaderVariants>(
  ({ className, outlined, balance, ...props }, ref) => (
    <Header
      as="header"
      size="600"
      className={classNames(css.PageHeader({ balance, outlined }), className)}
      {...props}
      ref={ref}
    />
  )
);

export const PageContent = as<'div'>(({ className, ...props }, ref) => (
  <div className={classNames(css.PageContent, className)} {...props} ref={ref} />
));

export function PageHeroEmpty({ children }: { children: ReactNode }) {
  return (
    <Box
      className={classNames(ContainerColor({ variant: 'SurfaceVariant' }), css.PageHeroEmpty)}
      direction="Column"
      alignItems="Center"
      justifyContent="Center"
      gap="200"
    >
      {children}
    </Box>
  );
}

export const PageHeroSection = as<'div', ComponentProps<typeof Box>>(
  ({ className, ...props }, ref) => (
    <Box
      direction="Column"
      className={classNames(css.PageHeroSection, className)}
      {...props}
      ref={ref}
    />
  )
);

export function PageHero({
  icon,
  title,
  subTitle,
  children,
}: {
  icon: ReactNode;
  title: ReactNode;
  subTitle: ReactNode;
  children?: ReactNode;
}) {
  return (
    <Box direction="Column" gap="400">
      <Box direction="Column" alignItems="Center" gap="200">
        {icon}
      </Box>
      <Box as="h2" direction="Column" gap="200" alignItems="Center">
        <Text align="Center" size="H2">
          {title}
        </Text>
        <Text align="Center" priority="400">
          {subTitle}
        </Text>
      </Box>
      {children}
    </Box>
  );
}

export const PageContentCenter = as<'div'>(({ className, ...props }, ref) => (
  <div className={classNames(css.PageContentCenter, className)} {...props} ref={ref} />
));
