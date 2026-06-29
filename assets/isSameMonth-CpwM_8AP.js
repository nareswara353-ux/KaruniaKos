import{c as m}from"./index-CE5G2Ef3.js";import{n as d,k as g,t as f,e as O,q as k}from"./toast-8HNiw2wZ.js";/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const _=[["path",{d:"M20 6 9 17l-5-5",key:"1gmf2c"}]],v=m("check",_);/**
 * @license lucide-react v0.546.0 - ISC
 *
 * This source code is licensed under the ISC license.
 * See the LICENSE file in the root directory of this source tree.
 */const w=[["path",{d:"m15 18-6-6 6-6",key:"1wnfg3"}]],F=m("chevron-left",w);function H(n,e,t){const[a,r]=d(t==null?void 0:t.in,n,e);return+g(a)==+g(r)}function Y(n,e){const t=f(n,e==null?void 0:e.in),a=t.getMonth();return t.setFullYear(t.getFullYear(),a+1,0),t.setHours(23,59,59,999),t}function y(n,e){const[t,a]=d(n,e.start,e.end);return{start:t,end:a}}function C(n,e){const{start:t,end:a}=y(e==null?void 0:e.in,n);let r=+t>+a;const u=r?+t:+a,c=r?a:t;c.setHours(0,0,0,0);let l=1;const s=[];for(;+c<=u;)s.push(O(t,c)),c.setDate(c.getDate()+l),c.setHours(0,0,0,0);return r?s.reverse():s}function I(n,e){const t=f(n,e==null?void 0:e.in);return t.setDate(1),t.setHours(0,0,0,0),t}function L(n,e){var l,s,h,D;const t=k(),a=(e==null?void 0:e.weekStartsOn)??((s=(l=e==null?void 0:e.locale)==null?void 0:l.options)==null?void 0:s.weekStartsOn)??t.weekStartsOn??((D=(h=t.locale)==null?void 0:h.options)==null?void 0:D.weekStartsOn)??0,r=f(n,e==null?void 0:e.in),u=r.getDay(),c=(u<a?-7:0)+6-(u-a);return r.setDate(r.getDate()+c),r.setHours(23,59,59,999),r}function z(n,e,t){const[a,r]=d(t==null?void 0:t.in,n,e);return a.getFullYear()===r.getFullYear()&&a.getMonth()===r.getMonth()}export{v as C,L as a,C as b,F as c,H as d,Y as e,z as i,y as n,I as s};
