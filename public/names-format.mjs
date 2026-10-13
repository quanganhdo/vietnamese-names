export function cleanName(value) {
  return value.normalize('NFC').replace(/^[\s"'“”‘’]+|[\s"'“”‘’]+$/g, '').replace(/\s+/g, ' ');
}

export function capitalizeFamily(value) {
  return value.normalize('NFC').toLocaleLowerCase('vi-VN').replace(/(^|[\s-])\p{L}/gu, match => match.toLocaleUpperCase('vi-VN'));
}

export function splitName(value) {
  const words = cleanName(value).split(/\s+/).filter(Boolean);
  return { givenName: words.at(-1) || '', middleName: words.slice(0, -1).join(' ') };
}

export function formatFullName(family, name, display = 'vi') {
  const surname = capitalizeFamily(family).trim().replace(/\s+/g, ' ');
  const { givenName, middleName } = splitName(name);
  if (display === 'en') {
    return [middleName, givenName, surname].filter(Boolean).join(' ')
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
  }
  return [surname, middleName, givenName].filter(Boolean).join(' ');
}

export function formatMachineName(family, name) {
  const component = value => value.toUpperCase()
    .replace(/[^A-Z\s,-]/g, '')
    .replace(/[\s,-]+/g, '<')
    .replace(/^<+|<+$/g, '');
  const surname = component(formatFullName(family, '', 'en'));
  const given = component(formatFullName('', name, 'en'));
  return `${surname}<<${given}`.padEnd(39, '<');
}
