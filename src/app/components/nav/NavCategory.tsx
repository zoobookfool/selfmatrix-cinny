import React, { ReactNode } from 'react';
import { as } from 'folds';
import classNames from 'classnames';
import * as css from './styles.css';

type NavCategoryProps = {
  children: ReactNode;
  chip?: boolean;
};
export const NavCategory = as<'div', NavCategoryProps>(({ className, chip, ...props }, ref) => (
  <div
    className={classNames(css.NavCategory, chip && css.NavCategoryHorizontal, className)}
    {...props}
    ref={ref}
  />
));
