#pragma once
#include <cJSON.h>
#include <cmath>
#include <cstdint>
#include <cstring>
#include <memory>
#include <string>
#include <vector>

namespace route_ui {
struct Leg { std::string from, to, line, type; uint32_t color; };
struct Route { int minutes = -1; std::vector<Leg> legs; };
inline bool ReadText(const cJSON* object, const char* key, std::string& out) {
    auto value = cJSON_GetObjectItemCaseSensitive(object, key);
    if (!cJSON_IsString(value) || !value->valuestring) return false;
    const size_t length = std::strlen(value->valuestring);
    if (!length || length > 256) return false;
    for (size_t i = 0; i < length; ++i) {
        const auto c = static_cast<unsigned char>(value->valuestring[i]);
        if (c < 32 || c == 127) return false;
    }
    out = value->valuestring;
    return true;
}
inline bool Parse(const std::string& data, Route& output) {
    if (data.empty() || data.size() > 16384 || data.find('\0') != std::string::npos ||
        data.find("\\u0000") != std::string::npos) return false;
    // Bound parser recursion before handing untrusted tool input to cJSON.
    int depth = 0; bool quoted = false, escaped = false;
    for (char c : data) {
        if (quoted) {
            if (escaped) escaped = false;
            else if (c == '\\') escaped = true;
            else if (c == '"') quoted = false;
        } else if (c == '"') quoted = true;
        else if (c == '{' || c == '[') { if (++depth > 8) return false; }
        else if (c == '}' || c == ']') { if (--depth < 0) return false; }
    }
    std::unique_ptr<cJSON, decltype(&cJSON_Delete)> json(
        cJSON_ParseWithLengthOpts(data.c_str(), data.size() + 1, nullptr, true), cJSON_Delete);
    if (!json || !cJSON_IsObject(json.get())) return false;
    auto version = cJSON_GetObjectItemCaseSensitive(json.get(), "version");
    if (!cJSON_IsNumber(version) || version->valuedouble != 1) return false;
    Route next;
    auto minutes = cJSON_GetObjectItemCaseSensitive(json.get(), "minutes");
    if (cJSON_IsNumber(minutes)) {
        const double n = minutes->valuedouble;
        if (!std::isfinite(n) || n < 0 || n > 99999 || std::floor(n) != n) return false;
        next.minutes = static_cast<int>(n);
    } else if (!cJSON_IsNull(minutes)) return false;
    auto legs = cJSON_GetObjectItemCaseSensitive(json.get(), "legs");
    if (!cJSON_IsArray(legs) || cJSON_GetArraySize(legs) < 1 || cJSON_GetArraySize(legs) > 30) return false;
    const cJSON* item;
    cJSON_ArrayForEach(item, legs) {
        Leg leg; std::string color;
        if (!ReadText(item, "from", leg.from) || !ReadText(item, "to", leg.to) ||
            !ReadText(item, "line", leg.line) || !ReadText(item, "type", leg.type) ||
            !ReadText(item, "color", color) || color.size() != 6) return false;
        leg.color = 0;
        for (char c : color) {
            int n = c >= '0' && c <= '9' ? c - '0' : c >= 'A' && c <= 'F' ? c - 'A' + 10 :
                c >= 'a' && c <= 'f' ? c - 'a' + 10 : -1;
            if (n < 0) return false;
            leg.color = (leg.color << 4) | n;
        }
        next.legs.push_back(std::move(leg));
    }
    output = std::move(next); // Invalid requests never replace the current route.
    return true;
}
// Page 0 is the overview; pages 1..N are individual legs.
inline int Previous(int page) { return page > 0 ? page - 1 : 0; }
inline int Next(int page, size_t legs) { return page < static_cast<int>(legs) ? page + 1 : 0; }
}
