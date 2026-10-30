"use client";
import { useEffect, useState } from "react";
import { renderFullPage } from "@/lib/card";
import { buildMessage } from "@/lib/message";
const S={groom:"Atick Ali Aouad",bride:"Fatouma Ahmed",event_date:"2026-11-06",men_time:"13h00",women_time:"15h00",venue:"Salle Kempinski, Djibouti",maps_url:"",card_bg:null,qr_x:31.45,qr_y:31.18,qr_size:37.1,name_x:52.06,name_y:64.33,name_w:60,name_color:"#3f4a2f",groom_y:8.9,bride_y:26.2,couple_w:70,couple_size:9.5,groom_color:"#4b5634",bride_color:"#b3a06a"};
export default function T(){const[u,setU]=useState();useEffect(()=>{const g={first_name:"Mohamed",last_name:"Abdillahi",token:"a1b2c3d4e5f6a7b8c9",gender:"F"};window.__m=buildMessage(S,g);renderFullPage(S,g).then(c=>setU(c.toDataURL()))},[]);return u?<img id="out" src={u} style={{width:620}}/>:null}
