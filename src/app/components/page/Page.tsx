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
    <Box
      grow="Yes"
      direction={direction}
      style={{ minWidth: 0, minHeight: 0 }}
      className={ContainerColor({ variant: 'Background' })}
    >
      {nav}
      {screenSize !== ScreenSize.Mobile && (
        <Line
          variant="Background"
          size="300"
          direction={stackDirection ? 'Horizontal' : 'Vertical'}
        />
      )}
      <Box grow="Yes" style={{ minWidth: 0, minHeight: 0 }}>
        {children}
      </Box>
    </Box>
  );
}

type MainPageRootProps = Omit<PageRootProps, 'reverse' | 'stackDirection'>;

/**
 * PageRoot variant for the main client routes (Home/Direct/Space/Explore/
 * Inbox) that reads the shell's channel-list docking preference and mirrors
 * PageRoot accordingly. Not used by Settings/SpaceSettings/RoomSettings,
 * which render PageRoot directly and are unaffected by this setting.
 */
export function MainPageRoot({ nav, children }: MainPageRootProps) {
  const shellLayout = useAtomValue(shellLayoutAtom);
  const navPosition = getNavPosition(shellLayout);

  if (isHorizontalDockPosition(navPosition)) {
    return (
      <PageRoot nav={nav} stackDirection={navPosition === 'bottom' ? 'ColumnReverse' : 'Column'}>
        {children}
      </PageRoot>
    );
  }

  // Non-horizontal positions keep the Stage 1 left/right row layout.
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
 * horizontal chip row. This is intentionally opt-in: nested PageNav usages
 * (Settings, RoomSettings, SpaceSettings) must not react to the shell's
 * channel-list docking preference.
 */
export function useChipNavLayout(chipNavSupported = false): boolean {
  const screenSize = useScreenSizeContext();
  const shellLayout = useAtomValue(shellLayoutAtom);
  const navPosition = getNavPosition(shellLayout);
  return (
    chipNavSupported && screenSize !== ScreenSize.Mobile && isHorizontalDockPosition(navPosition)
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
      style={{ minWidth: 0, minHeight: 0 }}
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
