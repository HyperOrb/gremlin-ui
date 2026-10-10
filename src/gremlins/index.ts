import { mobile } from './mobile.js';
import { forms } from './forms.js';
import { navigation } from './navigation.js';
import { keyboard } from './keyboard.js';
import { chaos } from './chaos.js';
import type { Gremlin } from '../core/types.js';
export const gremlins: Gremlin[] = [mobile, forms, navigation, keyboard, chaos];
