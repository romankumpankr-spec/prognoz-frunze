"use client";

import { useEffect, useState } from "react";
import { createClient } from "../lib/supabase/client";

type Lang = "ru" | "uk";

const RU_UK: Record<string,string> = {
  "На главную":"На головну","Вход в кабинет":"Вхід до кабінету","Вход по нику и паролю. Email участникам не нужен.":"Вхід за ніком і паролем. Email учасникам не потрібен.","Ник":"Нік","Пароль":"Пароль","Войти":"Увійти","Входим…":"Входимо…","Неверный ник или пароль.":"Невірний нік або пароль.",
  "Своя лига.":"Своя ліга.","Свои прогнозы.":"Свої прогнози.","Закрытая лига прогнозов для шести участников.":"Закрита ліга прогнозів для шести учасників.","Войти в кабинет →":"Увійти до кабінету →","Точный счёт":"Точний рахунок","Разница мячей":"Різниця м'ячів","Исход матча":"Результат матчу","Правила начисления очков":"Правила нарахування очок",
  "Прогнозы":"Прогнози","6 команд":"6 команд","Админка":"Адмінка","Общий чат":"Загальний чат","Личные сообщения":"Особисті повідомлення","Выйти":"Вийти","Мои прогнозы":"Мої прогнози","Турнирная таблица":"Турнірна таблиця","Общая таблица прогнозов":"Загальна таблиця прогнозів","Сохранить":"Зберегти","Сохранено":"Збережено","Отправить прогноз за тур":"Надіслати прогноз за тур","Отправить":"Надіслати","Пока сообщений нет. Напишите первым.":"Поки повідомлень немає. Напишіть першим.","Напишите сообщение…":"Напишіть повідомлення…","Приём открыт":"Прийом відкритий","Приём закрыт":"Прийом закритий","Фактический результат":"Фактичний результат","Мой прогноз:":"Мій прогноз:","отправлен":"надіслано","очк.":"очк.","Туры пока не добавлены.":"Тури ще не додані.","Пока никто не отправил прогноз.":"Поки ніхто не надіслав прогноз.","О матче":"Про матч","Главное":"Головне","Последние встречи":"Останні зустрічі","Источник статистики:":"Джерело статистики:","Профиль":"Профіль","Профиль:":"Профіль:","Пока нет участников.":"Поки немає учасників.","участников уже сделали выбор":"учасників уже зробили вибір","Выбор отправлен":"Вибір надіслано","Можно отправлять":"Можна надсилати","Нужно выбрать ещё":"Потрібно вибрати ще","Команды":"Команди","Нажми на команду, чтобы выбрать или убрать её.":"Натисни на команду, щоб вибрати або прибрати її.","Отправить выбор 6 команд":"Надіслати вибір 6 команд","Мой выбор":"Мій вибір","Пока ничего не выбрано.":"Поки нічого не вибрано.","Выбор участников":"Вибір учасників","После отправки":"Після надсилання","Выбор пуст":"Вибір порожній","Ещё не отправил":"Ще не надіслав","Сбросить":"Скинути","К турниру":"До турніру","Администрирование":"Адміністрування","Участник":"Учасник","Администратор":"Адміністратор"
};

function translate(value: string, lang: Lang) {
  if (lang === "ru") {
    for (const [ru, uk] of Object.entries(RU_UK)) value = value.replaceAll(uk, ru);
    return value;
  }
  for (const [ru, uk] of Object.entries(RU_UK)) value = value.replaceAll(ru, uk);
  return value;
}

export default function LanguageSwitcher() {
  const [lang, setLang] = useState<Lang>("ru");

  useEffect(() => {
    const saved = (localStorage.getItem("prognoz-lang") as Lang | null) ?? "ru";
    setLang(saved);
    const apply = () => {
      document.documentElement.lang = saved;
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      const nodes: Text[] = [];
      let node: Node | null;
      while ((node = walker.nextNode())) nodes.push(node as Text);
      for (const text of nodes) {
        const parent = text.parentElement;
        if (!parent || ["SCRIPT","STYLE","INPUT","TEXTAREA"].includes(parent.tagName)) continue;
        const next = translate(text.nodeValue ?? "", saved);
        if (next !== text.nodeValue) text.nodeValue = next;
      }
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(document.body, { childList:true, subtree:true, characterData:true });
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (window.location.pathname !== "/dashboard") return;
    const supabase = createClient();
    let ownerMap: Record<string,string> = {};
    let stopped = false;

    const applyOwners = () => {
      if (stopped || Object.keys(ownerMap).length === 0) return;
      const cards = document.querySelectorAll<HTMLElement>(".match-card h3");
      cards.forEach((heading) => {
        const firstText = heading.childNodes[0]?.textContent?.trim() ?? "";
        const textNodes = Array.from(heading.childNodes).filter(n => n.nodeType === Node.TEXT_NODE) as Text[];
        const home = firstText;
        const away = textNodes.length > 1 ? (textNodes[textNodes.length - 1].textContent?.trim() ?? "") : "";
        const homeOwner = ownerMap[home];
        const awayOwner = ownerMap[away];
        if (!homeOwner && !awayOwner) return;
        const marker = `${homeOwner ?? ""}|${awayOwner ?? ""}`;
        if (heading.dataset.ownersApplied === marker) return;
        const separator = document.createElement("span");
        separator.textContent = " — ";
        const homeNode = document.createTextNode(homeOwner ? `${home} (${homeOwner})` : home);
        const awayNode = document.createTextNode(awayOwner ? `${away} (${awayOwner})` : away);
        heading.replaceChildren(homeNode, separator, awayNode);
        heading.dataset.ownersApplied = marker;
      });
    };

    supabase.rpc("team_draft_public_board").then(({ data }) => {
      if (stopped) return;
      const board = data as { teams?: Array<{ team_name:string; user_id:string }> } | null;
      const teamRows = board?.teams ?? [];
      if (!teamRows.length) return;
      const ids = Array.from(new Set(teamRows.map(t => t.user_id)));
      supabase.from("profiles").select("id,display_name").in("id", ids).then(({ data: people }) => {
        if (stopped) return;
        const names: Record<string,string> = {};
        for (const person of people ?? []) names[person.id] = person.display_name;
        ownerMap = Object.fromEntries(teamRows.map(t => [t.team_name, names[t.user_id] ?? ""]));
        applyOwners();
      });
    });

    const observer = new MutationObserver(applyOwners);
    observer.observe(document.body, { childList:true, subtree:true });
    return () => { stopped = true; observer.disconnect(); };
  }, []);

  function change(next: Lang) {
    localStorage.setItem("prognoz-lang", next);
    setLang(next);
    document.documentElement.lang = next;
    window.location.reload();
  }

  return <div className="language-switcher" aria-label="Мова сайту">
    <button className={lang === "ru" ? "active" : ""} onClick={() => change("ru")}>RU</button>
    <button className={lang === "uk" ? "active" : ""} onClick={() => change("uk")}>UA</button>
  </div>;
}
